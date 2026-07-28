//! Local SQLite application database (S10.1/S10.3): the single source of
//! truth for connections (including passwords — see docs/adr/0002), saved
//! queries, history, dashboards, and settings. Lives at the macOS app-data
//! path (`~/Library/Application Support/com.greenberry.desktop/greenberry.db`).
//!
//! At-rest posture: plaintext columns in a file chmod'd 0600 (ADR 0002 —
//! explicitly accepted for a local, single-user tool; no OS keychain).
use std::path::Path;

use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};

use crate::db::DbError;

// ---------------------------------------------------------------- rows

/// Mirrors the frontend `StoredConnection` (serde camelCase over IPC).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredConnection {
    pub id: String,
    pub name: String,
    pub env: String,
    pub config: StoredConfig,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredConfig {
    pub engine: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    pub database: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ssl_mode: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub id: String,
    pub sql: String,
    pub ts: i64,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedQuery {
    pub id: String,
    pub name: String,
    pub sql: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Dashboard {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub payload: String,
}

/// SQL text of an open query tab (S3.7): survives tab switches and app
/// restarts; deleted when the tab closes. Keyed by stored-connection id +
/// the database the tab targets.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenQuery {
    pub id: String,
    pub conn_id: String,
    pub db: String,
    pub sql: String,
}

const HISTORY_CAP: i64 = 500;

// ---------------------------------------------------------------- appdb

#[derive(Clone)]
pub struct AppDb {
    pool: SqlitePool,
}

impl AppDb {
    /// Open (creating if missing) the app database, restrict it to the
    /// current user (0600), and run migrations.
    pub async fn open(path: &Path) -> Result<Self, DbError> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir)
                .map_err(|e| DbError::Connection(format!("app-db dir: {e}")))?;
        }
        let opts = SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(opts)
            .await?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            // ADR 0002: secrets rest in plaintext — the file must be user-only.
            let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
        }
        let db = AppDb { pool };
        db.migrate().await?;
        Ok(db)
    }

    async fn migrate(&self) -> Result<(), DbError> {
        let version: i64 = sqlx::query_scalar("PRAGMA user_version")
            .fetch_one(&self.pool)
            .await?;
        if version < 1 {
            for ddl in [
                "CREATE TABLE IF NOT EXISTS connections (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    env TEXT NOT NULL DEFAULT 'local',
                    engine TEXT NOT NULL,
                    host TEXT NOT NULL,
                    port INTEGER NOT NULL,
                    user TEXT NOT NULL,
                    password TEXT,
                    database TEXT NOT NULL,
                    ssl_mode TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )",
                "CREATE TABLE IF NOT EXISTS saved_queries (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    sql TEXT NOT NULL,
                    folder TEXT,
                    updated_at INTEGER NOT NULL
                )",
                "CREATE TABLE IF NOT EXISTS history (
                    id TEXT PRIMARY KEY,
                    sql TEXT NOT NULL,
                    ts INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    duration_ms REAL
                )",
                "CREATE TABLE IF NOT EXISTS dashboards (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    payload TEXT NOT NULL DEFAULT '{}'
                )",
                "CREATE TABLE IF NOT EXISTS kv (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )",
                "PRAGMA user_version = 1",
            ] {
                sqlx::query(ddl).execute(&self.pool).await?;
            }
        }
        if version < 2 {
            // v2 (S3.7): SQL text of open query tabs
            for ddl in [
                "CREATE TABLE IF NOT EXISTS open_queries (
                    id TEXT PRIMARY KEY,
                    conn_id TEXT NOT NULL,
                    db TEXT NOT NULL,
                    sql TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                )",
                "PRAGMA user_version = 2",
            ] {
                sqlx::query(ddl).execute(&self.pool).await?;
            }
        }
        Ok(())
    }

    fn now_ms() -> i64 {
        chrono::Utc::now().timestamp_millis()
    }

    // ------------------------------------------------------- connections

    pub async fn save_connection(&self, c: &StoredConnection) -> Result<(), DbError> {
        sqlx::query(
            "INSERT INTO connections
               (id, name, env, engine, host, port, user, password, database, ssl_mode, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name, env = excluded.env, engine = excluded.engine,
               host = excluded.host, port = excluded.port, user = excluded.user,
               password = excluded.password, database = excluded.database,
               ssl_mode = excluded.ssl_mode, updated_at = excluded.updated_at",
        )
        .bind(&c.id)
        .bind(&c.name)
        .bind(&c.env)
        .bind(&c.config.engine)
        .bind(&c.config.host)
        .bind(c.config.port as i64)
        .bind(&c.config.user)
        .bind(&c.config.password)
        .bind(&c.config.database)
        .bind(&c.config.ssl_mode)
        .bind(Self::now_ms())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn list_connections(&self) -> Result<Vec<StoredConnection>, DbError> {
        use sqlx::Row as _;
        let rows = sqlx::query(
            "SELECT id, name, env, engine, host, port, user, password, database, ssl_mode
             FROM connections ORDER BY created_at",
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|r| StoredConnection {
                id: r.get("id"),
                name: r.get("name"),
                env: r.get("env"),
                config: StoredConfig {
                    engine: r.get("engine"),
                    host: r.get("host"),
                    port: r.get::<i64, _>("port") as u16,
                    user: r.get("user"),
                    password: r.get("password"),
                    database: r.get("database"),
                    ssl_mode: r.get("ssl_mode"),
                },
            })
            .collect())
    }

    pub async fn delete_connection(&self, id: &str) -> Result<(), DbError> {
        sqlx::query("DELETE FROM connections WHERE id = ?1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ------------------------------------------------------- history

    pub async fn add_history(&self, h: &HistoryItem) -> Result<(), DbError> {
        sqlx::query(
            "INSERT OR REPLACE INTO history (id, sql, ts, status, duration_ms)
             VALUES (?1, ?2, ?3, ?4, ?5)",
        )
        .bind(&h.id)
        .bind(&h.sql)
        .bind(h.ts)
        .bind(&h.status)
        .bind(h.duration_ms)
        .execute(&self.pool)
        .await?;
        // keep only the newest HISTORY_CAP rows
        sqlx::query(
            "DELETE FROM history WHERE id NOT IN
               (SELECT id FROM history ORDER BY ts DESC LIMIT ?1)",
        )
        .bind(HISTORY_CAP)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn list_history(&self, limit: i64) -> Result<Vec<HistoryItem>, DbError> {
        use sqlx::Row as _;
        let rows = sqlx::query(
            "SELECT id, sql, ts, status, duration_ms FROM history ORDER BY ts DESC LIMIT ?1",
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|r| HistoryItem {
                id: r.get("id"),
                sql: r.get("sql"),
                ts: r.get("ts"),
                status: r.get("status"),
                duration_ms: r.get("duration_ms"),
            })
            .collect())
    }

    // ------------------------------------------------------- saved queries

    pub async fn save_query(&self, q: &SavedQuery) -> Result<(), DbError> {
        sqlx::query(
            "INSERT INTO saved_queries (id, name, sql, folder, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name, sql = excluded.sql,
               folder = excluded.folder, updated_at = excluded.updated_at",
        )
        .bind(&q.id)
        .bind(&q.name)
        .bind(&q.sql)
        .bind(&q.folder)
        .bind(Self::now_ms())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn list_queries(&self) -> Result<Vec<SavedQuery>, DbError> {
        use sqlx::Row as _;
        let rows =
            sqlx::query("SELECT id, name, sql, folder FROM saved_queries ORDER BY updated_at")
                .fetch_all(&self.pool)
                .await?;
        Ok(rows
            .into_iter()
            .map(|r| SavedQuery {
                id: r.get("id"),
                name: r.get("name"),
                sql: r.get("sql"),
                folder: r.get("folder"),
            })
            .collect())
    }

    pub async fn delete_query(&self, id: &str) -> Result<(), DbError> {
        sqlx::query("DELETE FROM saved_queries WHERE id = ?1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ------------------------------------------------------- dashboards

    pub async fn save_dashboard(&self, d: &Dashboard) -> Result<(), DbError> {
        sqlx::query(
            "INSERT INTO dashboards (id, name, payload) VALUES (?1, ?2, ?3)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, payload = excluded.payload",
        )
        .bind(&d.id)
        .bind(&d.name)
        .bind(&d.payload)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn list_dashboards(&self) -> Result<Vec<Dashboard>, DbError> {
        use sqlx::Row as _;
        let rows = sqlx::query("SELECT id, name, payload FROM dashboards ORDER BY name")
            .fetch_all(&self.pool)
            .await?;
        Ok(rows
            .into_iter()
            .map(|r| Dashboard {
                id: r.get("id"),
                name: r.get("name"),
                payload: r.get("payload"),
            })
            .collect())
    }

    // ------------------------------------------------------- open query tabs

    pub async fn save_open_query(&self, q: &OpenQuery) -> Result<(), DbError> {
        sqlx::query(
            "INSERT INTO open_queries (id, conn_id, db, sql, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET
               conn_id = excluded.conn_id, db = excluded.db,
               sql = excluded.sql, updated_at = excluded.updated_at",
        )
        .bind(&q.id)
        .bind(&q.conn_id)
        .bind(&q.db)
        .bind(&q.sql)
        .bind(Self::now_ms())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn list_open_queries(&self, conn_id: &str) -> Result<Vec<OpenQuery>, DbError> {
        use sqlx::Row as _;
        let rows = sqlx::query(
            "SELECT id, conn_id, db, sql FROM open_queries
             WHERE conn_id = ?1 ORDER BY updated_at",
        )
        .bind(conn_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|r| OpenQuery {
                id: r.get("id"),
                conn_id: r.get("conn_id"),
                db: r.get("db"),
                sql: r.get("sql"),
            })
            .collect())
    }

    pub async fn delete_open_query(&self, id: &str) -> Result<(), DbError> {
        sqlx::query("DELETE FROM open_queries WHERE id = ?1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ------------------------------------------------------- settings (kv)

    pub async fn get_kv(&self, key: &str) -> Result<Option<String>, DbError> {
        let v: Option<String> = sqlx::query_scalar("SELECT value FROM kv WHERE key = ?1")
            .bind(key)
            .fetch_optional(&self.pool)
            .await?;
        Ok(v)
    }

    pub async fn set_kv(&self, key: &str, value: &str) -> Result<(), DbError> {
        sqlx::query(
            "INSERT INTO kv (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .bind(key)
        .bind(value)
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}
