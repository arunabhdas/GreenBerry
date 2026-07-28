//! Engine-agnostic database access layer (S1.3).
//!
//! Implements the command surface — connect / query / cancel / introspect —
//! on top of the S1.2 decision (Rust `sqlx`, in-process). Postgres is the
//! reference engine; MySQL/SQLite/SQL Server land behind the same types in E2.
use std::collections::{BTreeMap, HashMap, HashSet};
use std::time::{Duration, Instant};

use serde::ser::SerializeStruct;
use serde::{Deserialize, Serialize, Serializer};
use sqlx::postgres::{PgConnectOptions, PgPool, PgPoolOptions, PgSslMode};
use sqlx::{Column as _, Executor as _, Row as _, TypeInfo as _};
use tokio::sync::Mutex;

// ---------------------------------------------------------------- config

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Engine {
    Postgres,
    Mysql,
    Sqlite,
    Mssql,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionConfig {
    pub engine: Engine,
    pub host: String,
    pub port: u16,
    pub user: String,
    #[serde(default)]
    pub password: Option<String>,
    pub database: String,
    #[serde(default)]
    pub ssl_mode: Option<String>,
}

// ---------------------------------------------------------------- error

#[derive(Debug, Clone)]
pub enum DbError {
    Connection(String),
    Query(String),
    NotConnected(String),
    Unsupported(String),
}

impl DbError {
    pub fn kind(&self) -> &'static str {
        match self {
            DbError::Connection(_) => "connection",
            DbError::Query(_) => "query",
            DbError::NotConnected(_) => "notConnected",
            DbError::Unsupported(_) => "unsupported",
        }
    }
    pub fn message(&self) -> &str {
        match self {
            DbError::Connection(m)
            | DbError::Query(m)
            | DbError::NotConnected(m)
            | DbError::Unsupported(m) => m,
        }
    }
}

impl std::fmt::Display for DbError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.kind(), self.message())
    }
}
impl std::error::Error for DbError {}

// Tauri requires command errors to be Serialize; emit { kind, message }.
impl Serialize for DbError {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let mut st = s.serialize_struct("DbError", 2)?;
        st.serialize_field("kind", self.kind())?;
        st.serialize_field("message", self.message())?;
        st.end()
    }
}

impl From<sqlx::Error> for DbError {
    fn from(e: sqlx::Error) -> Self {
        match &e {
            sqlx::Error::Database(db) => DbError::Query(db.message().to_string()),
            sqlx::Error::PoolTimedOut
            | sqlx::Error::Io(_)
            | sqlx::Error::Tls(_)
            | sqlx::Error::Configuration(_) => DbError::Connection(e.to_string()),
            _ => DbError::Query(e.to_string()),
        }
    }
}

// ---------------------------------------------------------------- results

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub row_count: usize,
    pub rows_affected: u64,
    pub elapsed_ms: f64,
    pub truncated: bool,
}

// ---------------------------------------------------------------- introspection

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnRef {
    pub schema: String,
    pub table: String,
    pub column: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnMeta {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub primary_key: bool,
    pub references: Option<ColumnRef>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableMeta {
    pub name: String,
    pub kind: String, // "table" | "view"
    pub columns: Vec<ColumnMeta>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaMeta {
    pub name: String,
    pub tables: Vec<TableMeta>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub schemas: Vec<SchemaMeta>,
}

/// token -> backend pid / connection id, so `db_cancel` can target an
/// in-flight statement (i64 covers both PG pids and MySQL connection ids).
pub type ActiveQueries = Mutex<HashMap<String, i64>>;

// ---------------------------------------------------------------- client

#[derive(Clone)]
pub struct PgClient {
    pool: PgPool,
}

fn parse_ssl(mode: &str) -> PgSslMode {
    match mode.to_ascii_lowercase().as_str() {
        "disable" => PgSslMode::Disable,
        "allow" => PgSslMode::Allow,
        "require" => PgSslMode::Require,
        "verify-ca" | "verify_ca" => PgSslMode::VerifyCa,
        "verify-full" | "verify_full" => PgSslMode::VerifyFull,
        _ => PgSslMode::Prefer,
    }
}

/// Whether the first keyword yields a result set we should render as a grid.
fn returns_rows(sql: &str) -> bool {
    let first = sql
        .trim_start()
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_ascii_uppercase();
    matches!(first.as_str(), "SELECT" | "WITH" | "VALUES" | "TABLE")
}

impl PgClient {
    pub async fn connect(cfg: &ConnectionConfig) -> Result<Self, DbError> {
        if cfg.engine != Engine::Postgres {
            return Err(DbError::Unsupported(format!(
                "{:?} adapter not implemented yet (E2)",
                cfg.engine
            )));
        }
        let mut opts = PgConnectOptions::new()
            .host(&cfg.host)
            .port(cfg.port)
            .username(&cfg.user)
            .database(&cfg.database);
        if let Some(p) = &cfg.password {
            opts = opts.password(p);
        }
        if let Some(m) = &cfg.ssl_mode {
            opts = opts.ssl_mode(parse_ssl(m));
        }
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .acquire_timeout(Duration::from_secs(15))
            .connect_with(opts)
            .await
            .map_err(|e| DbError::Connection(e.to_string()))?;
        Ok(Self { pool })
    }

    pub async fn ping(&self) -> Result<(), DbError> {
        sqlx::query("SELECT 1").execute(&self.pool).await?;
        Ok(())
    }

    /// Run a statement, registering its backend pid so it can be cancelled.
    pub async fn run_query(
        &self,
        sql: &str,
        limit: i64,
        active: &ActiveQueries,
        token: &str,
    ) -> Result<QueryResult, DbError> {
        let start = Instant::now();
        let mut conn = self.pool.acquire().await?;
        let pid: i32 = sqlx::query_scalar("SELECT pg_backend_pid()")
            .fetch_one(&mut *conn)
            .await?;
        active.lock().await.insert(token.to_string(), pid as i64);

        let out = Self::exec(&mut conn, sql, limit).await;

        active.lock().await.remove(token);
        out.map(|mut r| {
            r.elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;
            r
        })
    }

    async fn exec(
        conn: &mut sqlx::pool::PoolConnection<sqlx::Postgres>,
        sql: &str,
        limit: i64,
    ) -> Result<QueryResult, DbError> {
        let sql = sql.trim().trim_end_matches(';').trim();
        if sql.is_empty() {
            return Err(DbError::Query("empty statement".into()));
        }

        // Non row-returning: report rows affected.
        if !returns_rows(sql) {
            let res = sqlx::query(sql).execute(&mut **conn).await?;
            return Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                row_count: 0,
                rows_affected: res.rows_affected(),
                elapsed_ms: 0.0,
                truncated: false,
            });
        }

        // Real column names + SQL types via describe (no execution).
        let described = (&mut **conn).describe(sql).await?;
        let columns: Vec<ColumnInfo> = described
            .columns()
            .iter()
            .map(|c| ColumnInfo {
                name: c.name().to_string(),
                data_type: c.type_info().name().to_string(),
            })
            .collect();

        // Values as correctly-typed JSON via Postgres `to_jsonb`; fetch limit+1
        // to detect truncation without a second count query.
        let wrapped = format!("SELECT to_jsonb(__q) AS __row FROM ({sql}) __q LIMIT {}", limit + 1);
        let fetched = sqlx::query(&wrapped).fetch_all(&mut **conn).await?;

        let mut objs: Vec<serde_json::Value> = Vec::with_capacity(fetched.len());
        for r in &fetched {
            objs.push(r.try_get::<serde_json::Value, _>("__row")?);
        }
        let truncated = objs.len() as i64 > limit;
        if truncated {
            objs.truncate(limit as usize);
        }

        let rows: Vec<Vec<serde_json::Value>> = objs
            .iter()
            .map(|o| {
                columns
                    .iter()
                    .map(|c| o.get(&c.name).cloned().unwrap_or(serde_json::Value::Null))
                    .collect()
            })
            .collect();

        Ok(QueryResult {
            row_count: rows.len(),
            columns,
            rows,
            rows_affected: 0,
            elapsed_ms: 0.0,
            truncated,
        })
    }

    /// Cancel an in-flight statement by backend pid (from a fresh connection).
    pub async fn cancel(&self, pid: i64) -> Result<bool, DbError> {
        let ok: bool = sqlx::query_scalar("SELECT pg_cancel_backend($1)")
            .bind(pid as i32)
            .fetch_one(&self.pool)
            .await?;
        Ok(ok)
    }

    /// Server-level databases (like `\list`). A Postgres connection is bound to
    /// one database, so the sidebar switcher reconnects to browse another.
    pub async fn list_databases(&self) -> Result<Vec<String>, DbError> {
        let dbs: Vec<String> = sqlx::query_scalar(
            "SELECT datname FROM pg_database \
             WHERE datistemplate = false AND datallowconn ORDER BY datname",
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(dbs)
    }

    /// Server-level roles (like `\du`). Best-effort: returns empty if the
    /// connected user lacks visibility rather than failing the whole load.
    pub async fn list_roles(&self) -> Result<Vec<String>, DbError> {
        let roles: Vec<String> =
            sqlx::query_scalar("SELECT rolname FROM pg_roles ORDER BY rolname")
                .fetch_all(&self.pool)
                .await
                .unwrap_or_default();
        Ok(roles)
    }

    /// Apply staged statements atomically in one transaction (S4.5). On any
    /// error the whole batch rolls back and the failing statement is reported.
    pub async fn exec_batch(&self, statements: &[String]) -> Result<u64, DbError> {
        let mut tx = self.pool.begin().await?;
        let mut affected: u64 = 0;
        for (i, stmt) in statements.iter().enumerate() {
            let s = stmt.trim().trim_end_matches(';').trim();
            if s.is_empty() {
                continue;
            }
            match sqlx::query(s).execute(&mut *tx).await {
                Ok(r) => affected += r.rows_affected(),
                Err(e) => return Err(DbError::Query(format!("statement {}: {}", i + 1, e))),
            }
        }
        tx.commit().await?;
        Ok(affected)
    }

    pub async fn introspect(&self) -> Result<Catalog, DbError> {
        // primary-key columns
        let pk_rows = sqlx::query(
            "SELECT tc.table_schema, tc.table_name, kcu.column_name
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu
               ON kcu.constraint_name = tc.constraint_name
              AND kcu.table_schema = tc.table_schema
             WHERE tc.constraint_type = 'PRIMARY KEY'",
        )
        .fetch_all(&self.pool)
        .await?;
        let mut pks: HashSet<(String, String, String)> = HashSet::new();
        for r in &pk_rows {
            pks.insert((
                r.try_get("table_schema")?,
                r.try_get("table_name")?,
                r.try_get("column_name")?,
            ));
        }

        // foreign keys (S4.8): (schema,table,column) -> referenced column
        let fk_rows = sqlx::query(
            "SELECT tc.table_schema, tc.table_name, kcu.column_name,
                    ccu.table_schema AS ref_schema, ccu.table_name AS ref_table,
                    ccu.column_name AS ref_column
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu
               ON kcu.constraint_name = tc.constraint_name
              AND kcu.table_schema = tc.table_schema
             JOIN information_schema.constraint_column_usage ccu
               ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
             WHERE tc.constraint_type = 'FOREIGN KEY'",
        )
        .fetch_all(&self.pool)
        .await?;
        let mut fks: HashMap<(String, String, String), ColumnRef> = HashMap::new();
        for r in &fk_rows {
            fks.insert(
                (
                    r.try_get("table_schema")?,
                    r.try_get("table_name")?,
                    r.try_get("column_name")?,
                ),
                ColumnRef {
                    schema: r.try_get("ref_schema")?,
                    table: r.try_get("ref_table")?,
                    column: r.try_get("ref_column")?,
                },
            );
        }

        let rows = sqlx::query(
            "SELECT t.table_schema, t.table_name, t.table_type,
                    c.column_name, c.data_type, c.is_nullable
             FROM information_schema.tables t
             JOIN information_schema.columns c
               ON c.table_schema = t.table_schema AND c.table_name = t.table_name
             WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
             ORDER BY t.table_schema, t.table_name, c.ordinal_position",
        )
        .fetch_all(&self.pool)
        .await?;

        // schema -> table -> (kind, columns)
        let mut grouped: BTreeMap<String, BTreeMap<String, (String, Vec<ColumnMeta>)>> =
            BTreeMap::new();
        for r in &rows {
            let schema: String = r.try_get("table_schema")?;
            let table: String = r.try_get("table_name")?;
            let ttype: String = r.try_get("table_type")?;
            let col: String = r.try_get("column_name")?;
            let dtype: String = r.try_get("data_type")?;
            let nullable: String = r.try_get("is_nullable")?;
            let key = (schema.clone(), table.clone(), col.clone());
            let pk = pks.contains(&key);
            let references = fks.get(&key).cloned();
            let kind = if ttype == "VIEW" { "view" } else { "table" }.to_string();
            let entry = grouped
                .entry(schema)
                .or_default()
                .entry(table)
                .or_insert((kind, Vec::new()));
            entry.1.push(ColumnMeta {
                name: col,
                data_type: dtype,
                nullable: nullable == "YES",
                primary_key: pk,
                references,
            });
        }

        Ok(Catalog {
            schemas: grouped
                .into_iter()
                .map(|(name, tables)| SchemaMeta {
                    name,
                    tables: tables
                        .into_iter()
                        .map(|(name, (kind, columns))| TableMeta { name, kind, columns })
                        .collect(),
                })
                .collect(),
        })
    }
}

// ---------------------------------------------------------------- MySQL client

#[derive(Clone)]
pub struct MyClient {
    pool: sqlx::MySqlPool,
}

impl MyClient {
    pub async fn connect(cfg: &ConnectionConfig) -> Result<Self, DbError> {
        let mut opts = sqlx::mysql::MySqlConnectOptions::new()
            .host(&cfg.host)
            .port(cfg.port)
            .username(&cfg.user)
            .database(&cfg.database);
        if let Some(p) = &cfg.password {
            opts = opts.password(p);
        }
        let pool = sqlx::mysql::MySqlPoolOptions::new()
            .max_connections(5)
            .acquire_timeout(Duration::from_secs(15))
            .connect_with(opts)
            .await
            .map_err(|e| DbError::Connection(e.to_string()))?;
        Ok(Self { pool })
    }

    pub async fn ping(&self) -> Result<(), DbError> {
        sqlx::query("SELECT 1").execute(&self.pool).await?;
        Ok(())
    }

    pub async fn run_query(
        &self,
        sql: &str,
        limit: i64,
        active: &ActiveQueries,
        token: &str,
    ) -> Result<QueryResult, DbError> {
        let start = Instant::now();
        let mut conn = self.pool.acquire().await?;
        let cid: u64 = sqlx::query_scalar("SELECT CONNECTION_ID()")
            .fetch_one(&mut *conn)
            .await?;
        active.lock().await.insert(token.to_string(), cid as i64);

        let out = Self::exec(&mut conn, sql, limit).await;

        active.lock().await.remove(token);
        out.map(|mut r| {
            r.elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;
            r
        })
    }

    async fn exec(
        conn: &mut sqlx::pool::PoolConnection<sqlx::MySql>,
        sql: &str,
        limit: i64,
    ) -> Result<QueryResult, DbError> {
        let sql = sql.trim().trim_end_matches(';').trim();
        if sql.is_empty() {
            return Err(DbError::Query("empty statement".into()));
        }

        if !returns_rows(sql) {
            let res = sqlx::query(sql).execute(&mut **conn).await?;
            return Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                row_count: 0,
                rows_affected: res.rows_affected(),
                elapsed_ms: 0.0,
                truncated: false,
            });
        }

        let described = (&mut **conn).describe(sql).await?;
        let columns: Vec<ColumnInfo> = described
            .columns()
            .iter()
            .map(|c| ColumnInfo {
                name: c.name().to_string(),
                data_type: c.type_info().name().to_string(),
            })
            .collect();

        // typed JSON via MySQL JSON_OBJECT('col', `col`, ...)
        let pairs = columns
            .iter()
            .map(|c| {
                format!(
                    "'{}', `{}`",
                    c.name.replace('\'', "''"),
                    c.name.replace('`', "``")
                )
            })
            .collect::<Vec<_>>()
            .join(", ");
        let wrapped = format!(
            "SELECT JSON_OBJECT({pairs}) AS __row FROM ({sql}) __q LIMIT {}",
            limit + 1
        );
        let fetched = sqlx::query(&wrapped).fetch_all(&mut **conn).await?;

        let mut objs: Vec<serde_json::Value> = Vec::with_capacity(fetched.len());
        for r in &fetched {
            let v: serde_json::Value = r
                .try_get::<serde_json::Value, _>("__row")
                .or_else(|_| {
                    r.try_get::<String, _>("__row")
                        .map(|s| serde_json::from_str(&s).unwrap_or(serde_json::Value::Null))
                })?;
            objs.push(v);
        }
        let truncated = objs.len() as i64 > limit;
        if truncated {
            objs.truncate(limit as usize);
        }

        let rows: Vec<Vec<serde_json::Value>> = objs
            .iter()
            .map(|o| {
                columns
                    .iter()
                    .map(|c| o.get(&c.name).cloned().unwrap_or(serde_json::Value::Null))
                    .collect()
            })
            .collect();

        Ok(QueryResult {
            row_count: rows.len(),
            columns,
            rows,
            rows_affected: 0,
            elapsed_ms: 0.0,
            truncated,
        })
    }

    pub async fn cancel(&self, cid: i64) -> Result<bool, DbError> {
        sqlx::query(&format!("KILL QUERY {cid}"))
            .execute(&self.pool)
            .await?;
        Ok(true)
    }

    /// Server-level databases (schemas, in MySQL terms). System schemas are
    /// hidden. CAST(... AS CHAR) avoids the binary-decode issue seen elsewhere.
    pub async fn list_databases(&self) -> Result<Vec<String>, DbError> {
        let dbs: Vec<String> = sqlx::query_scalar(
            "SELECT CAST(schema_name AS CHAR) FROM information_schema.schemata \
             WHERE schema_name NOT IN ('information_schema','performance_schema','sys','mysql') \
             ORDER BY schema_name",
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(dbs)
    }

    /// Server-level accounts. Best-effort: needs SELECT on `mysql.user`, so
    /// returns empty rather than failing when the connected user lacks it.
    pub async fn list_roles(&self) -> Result<Vec<String>, DbError> {
        let roles: Vec<String> = sqlx::query_scalar(
            "SELECT CAST(user AS CHAR) FROM mysql.user ORDER BY user",
        )
        .fetch_all(&self.pool)
        .await
        .unwrap_or_default();
        Ok(roles)
    }

    pub async fn introspect(&self) -> Result<Catalog, DbError> {
        // MySQL information_schema returns UPPERCASE column names — alias to
        // explicit lowercase so try_get matches.
        let pk_rows = sqlx::query(
            "SELECT table_name AS t, column_name AS c FROM information_schema.key_column_usage
             WHERE constraint_name = 'PRIMARY' AND table_schema = DATABASE()",
        )
        .fetch_all(&self.pool)
        .await?;
        let mut pks: HashSet<(String, String)> = HashSet::new();
        for r in &pk_rows {
            pks.insert((r.try_get("t")?, r.try_get("c")?));
        }

        let fk_rows = sqlx::query(
            "SELECT table_name AS t, column_name AS c,
                    referenced_table_schema AS ref_schema,
                    referenced_table_name AS ref_table, referenced_column_name AS ref_column
             FROM information_schema.key_column_usage
             WHERE referenced_table_name IS NOT NULL AND table_schema = DATABASE()",
        )
        .fetch_all(&self.pool)
        .await?;
        let mut fks: HashMap<(String, String), ColumnRef> = HashMap::new();
        for r in &fk_rows {
            fks.insert(
                (r.try_get("t")?, r.try_get("c")?),
                ColumnRef {
                    schema: r.try_get("ref_schema")?,
                    table: r.try_get("ref_table")?,
                    column: r.try_get("ref_column")?,
                },
            );
        }

        let db_name: String = sqlx::query_scalar("SELECT DATABASE()")
            .fetch_one(&self.pool)
            .await?;

        let rows = sqlx::query(
            "SELECT CAST(t.table_name AS CHAR) AS tname, CAST(t.table_type AS CHAR) AS ttype,
                    CAST(c.column_name AS CHAR) AS cname, CAST(c.data_type AS CHAR) AS dtype,
                    CAST(c.is_nullable AS CHAR) AS nullable
             FROM information_schema.tables t
             JOIN information_schema.columns c
               ON c.table_schema = t.table_schema AND c.table_name = t.table_name
             WHERE t.table_schema = DATABASE()
             ORDER BY t.table_name, c.ordinal_position",
        )
        .fetch_all(&self.pool)
        .await?;

        let mut grouped: BTreeMap<String, (String, Vec<ColumnMeta>)> = BTreeMap::new();
        for r in &rows {
            let table: String = r.try_get("tname")?;
            let ttype: String = r.try_get("ttype")?;
            let col: String = r.try_get("cname")?;
            let dtype: String = r.try_get("dtype")?;
            let nullable: String = r.try_get("nullable")?;
            let pk = pks.contains(&(table.clone(), col.clone()));
            let references = fks.get(&(table.clone(), col.clone())).cloned();
            let kind = if ttype == "VIEW" { "view" } else { "table" }.to_string();
            let entry = grouped.entry(table).or_insert((kind, Vec::new()));
            entry.1.push(ColumnMeta {
                name: col,
                data_type: dtype,
                nullable: nullable == "YES",
                primary_key: pk,
                references,
            });
        }

        Ok(Catalog {
            schemas: vec![SchemaMeta {
                name: db_name,
                tables: grouped
                    .into_iter()
                    .map(|(name, (kind, columns))| TableMeta { name, kind, columns })
                    .collect(),
            }],
        })
    }

    pub async fn exec_batch(&self, statements: &[String]) -> Result<u64, DbError> {
        let mut tx = self.pool.begin().await?;
        let mut affected: u64 = 0;
        for (i, stmt) in statements.iter().enumerate() {
            let s = stmt.trim().trim_end_matches(';').trim();
            if s.is_empty() {
                continue;
            }
            match sqlx::query(s).execute(&mut *tx).await {
                Ok(r) => affected += r.rows_affected(),
                Err(e) => return Err(DbError::Query(format!("statement {}: {}", i + 1, e))),
            }
        }
        tx.commit().await?;
        Ok(affected)
    }
}

// ---------------------------------------------------------------- engine dispatch

#[derive(Clone)]
pub enum DbClient {
    Postgres(PgClient),
    Mysql(MyClient),
}

impl DbClient {
    pub async fn connect(cfg: &ConnectionConfig) -> Result<Self, DbError> {
        match cfg.engine {
            Engine::Postgres => Ok(DbClient::Postgres(PgClient::connect(cfg).await?)),
            Engine::Mysql => Ok(DbClient::Mysql(MyClient::connect(cfg).await?)),
            other => Err(DbError::Unsupported(format!(
                "{other:?} adapter not implemented yet"
            ))),
        }
    }
    pub async fn ping(&self) -> Result<(), DbError> {
        match self {
            DbClient::Postgres(c) => c.ping().await,
            DbClient::Mysql(c) => c.ping().await,
        }
    }
    pub async fn run_query(
        &self,
        sql: &str,
        limit: i64,
        active: &ActiveQueries,
        token: &str,
    ) -> Result<QueryResult, DbError> {
        match self {
            DbClient::Postgres(c) => c.run_query(sql, limit, active, token).await,
            DbClient::Mysql(c) => c.run_query(sql, limit, active, token).await,
        }
    }
    pub async fn cancel(&self, id: i64) -> Result<bool, DbError> {
        match self {
            DbClient::Postgres(c) => c.cancel(id).await,
            DbClient::Mysql(c) => c.cancel(id).await,
        }
    }
    pub async fn introspect(&self) -> Result<Catalog, DbError> {
        match self {
            DbClient::Postgres(c) => c.introspect().await,
            DbClient::Mysql(c) => c.introspect().await,
        }
    }
    pub async fn exec_batch(&self, statements: &[String]) -> Result<u64, DbError> {
        match self {
            DbClient::Postgres(c) => c.exec_batch(statements).await,
            DbClient::Mysql(c) => c.exec_batch(statements).await,
        }
    }
    pub async fn list_databases(&self) -> Result<Vec<String>, DbError> {
        match self {
            DbClient::Postgres(c) => c.list_databases().await,
            DbClient::Mysql(c) => c.list_databases().await,
        }
    }
    pub async fn list_roles(&self) -> Result<Vec<String>, DbError> {
        match self {
            DbClient::Postgres(c) => c.list_roles().await,
            DbClient::Mysql(c) => c.list_roles().await,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_row_returning_statements() {
        assert!(returns_rows("select 1"));
        assert!(returns_rows("  WITH x AS (SELECT 1) SELECT * FROM x"));
        assert!(returns_rows("VALUES (1),(2)"));
        assert!(!returns_rows("insert into t values (1)"));
        assert!(!returns_rows("CREATE TABLE t (id int)"));
        assert!(!returns_rows("update t set a = 1"));
    }

    #[test]
    fn parses_ssl_modes() {
        assert!(matches!(parse_ssl("require"), PgSslMode::Require));
        assert!(matches!(parse_ssl("verify-full"), PgSslMode::VerifyFull));
        assert!(matches!(parse_ssl("disable"), PgSslMode::Disable));
        assert!(matches!(parse_ssl("nonsense"), PgSslMode::Prefer));
    }

    #[test]
    fn error_serializes_kind_and_message() {
        let v = serde_json::to_value(DbError::NotConnected("abc".into())).unwrap();
        assert_eq!(v["kind"], "notConnected");
        assert_eq!(v["message"], "abc");
    }
}
