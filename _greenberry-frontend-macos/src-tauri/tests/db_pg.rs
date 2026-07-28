//! Integration tests for the Postgres adapter (S1.3).
//! Skipped unless `GB_TEST_PG_USER` is set, so `cargo test` passes in CI
//! without a database. Run locally with e.g.
//!   GB_TEST_PG_USER=$USER cargo test --test db_pg -- --nocapture
use std::collections::HashMap;

use greenberry_frontend_macos_lib::db::{ConnectionConfig, Engine, PgClient};
use tokio::sync::Mutex;

fn env_cfg() -> Option<ConnectionConfig> {
    let user = std::env::var("GB_TEST_PG_USER").ok()?;
    Some(ConnectionConfig {
        engine: Engine::Postgres,
        host: std::env::var("GB_TEST_PG_HOST").unwrap_or_else(|_| "localhost".into()),
        port: std::env::var("GB_TEST_PG_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(5432),
        user,
        password: std::env::var("GB_TEST_PG_PASSWORD").ok(),
        database: std::env::var("GB_TEST_PG_DB").unwrap_or_else(|_| "postgres".into()),
        ssl_mode: None,
    })
}

#[tokio::test]
async fn connect_query_introspect() {
    let Some(cfg) = env_cfg() else {
        eprintln!("skipping db_pg: set GB_TEST_PG_USER to run");
        return;
    };
    let client = PgClient::connect(&cfg).await.expect("connect");
    let active = Mutex::new(HashMap::new());

    // typed values arrive as JSON of the right shape
    let r = client
        .run_query("SELECT 1 AS n, 'hi' AS s, true AS b", 100, &active, "t1")
        .await
        .expect("query");
    assert_eq!(r.columns.len(), 3);
    assert_eq!(r.columns[0].name, "n");
    assert_eq!(r.row_count, 1);
    assert_eq!(r.rows[0][0], serde_json::json!(1));
    assert_eq!(r.rows[0][1], serde_json::json!("hi"));
    assert_eq!(r.rows[0][2], serde_json::json!(true));
    assert!(!r.truncated);

    // limit + truncation flag
    let r2 = client
        .run_query("SELECT g FROM generate_series(1, 50) g", 10, &active, "t2")
        .await
        .expect("query2");
    assert_eq!(r2.row_count, 10);
    assert!(r2.truncated);

    // non row-returning statement reports rows_affected
    let r3 = client
        .run_query("CREATE TEMP TABLE _gb_probe (id int)", 100, &active, "t3")
        .await
        .expect("ddl");
    assert_eq!(r3.row_count, 0);

    // introspection returns a catalog (schemas present) without error
    let cat = client.introspect().await.expect("introspect");
    assert!(cat.schemas.iter().any(|s| s.name == "public"));
}

#[tokio::test]
async fn exec_batch_and_fk_introspection() {
    let Some(cfg) = env_cfg() else {
        eprintln!("skipping exec_batch: set GB_TEST_PG_USER to run");
        return;
    };
    let client = PgClient::connect(&cfg).await.expect("connect");
    let active = Mutex::new(HashMap::new());
    let q = |sql: &'static str, t: &'static str| {
        let c = client.clone();
        let a = &active;
        async move { c.run_query(sql, 5, a, t).await }
    };

    q("DROP TABLE IF EXISTS _gb_child", "d0").await.ok();
    q("DROP TABLE IF EXISTS _gb_parent", "d1").await.ok();
    q("CREATE TABLE _gb_parent (id int primary key)", "c0").await.unwrap();
    q(
        "CREATE TABLE _gb_child (id int primary key, parent_id int references _gb_parent(id))",
        "c1",
    )
    .await
    .unwrap();

    // batch commits atomically
    let n = client
        .exec_batch(&[
            "INSERT INTO _gb_parent (id) VALUES (1)".into(),
            "INSERT INTO _gb_child (id, parent_id) VALUES (10, 1)".into(),
        ])
        .await
        .expect("batch commit");
    assert_eq!(n, 2);

    // a failing batch rolls back entirely
    let before = q("SELECT count(*) c FROM _gb_parent", "b0").await.unwrap();
    let err = client
        .exec_batch(&[
            "INSERT INTO _gb_parent (id) VALUES (2)".into(),
            "INSERT INTO _gb_parent (id) VALUES (1)".into(), // duplicate pk → fails
        ])
        .await;
    assert!(err.is_err());
    let after = q("SELECT count(*) c FROM _gb_parent", "b1").await.unwrap();
    assert_eq!(before.rows, after.rows); // unchanged

    // FK introspection surfaces the reference
    let cat = client.introspect().await.unwrap();
    let child = cat
        .schemas
        .iter()
        .flat_map(|s| &s.tables)
        .find(|t| t.name == "_gb_child")
        .expect("child table");
    let fk = child
        .columns
        .iter()
        .find(|c| c.name == "parent_id")
        .expect("parent_id column");
    assert_eq!(fk.references.as_ref().expect("fk ref").table, "_gb_parent");

    q("DROP TABLE _gb_child", "z0").await.ok();
    q("DROP TABLE _gb_parent", "z1").await.ok();
}

#[tokio::test]
async fn lists_server_databases_and_roles() {
    let Some(cfg) = env_cfg() else {
        eprintln!("skipping list_databases: set GB_TEST_PG_USER to run");
        return;
    };
    let client = PgClient::connect(&cfg).await.expect("connect");

    // databases: mirrors `\list` — the connected db is always present, and
    // templates are excluded.
    let dbs = client.list_databases().await.expect("list_databases");
    assert!(dbs.contains(&cfg.database), "connected db must appear");
    assert!(!dbs.iter().any(|d| d == "template0"), "templates excluded");

    // roles: mirrors `\du` — the connecting user is a role, so non-empty.
    let roles = client.list_roles().await.expect("list_roles");
    assert!(roles.contains(&cfg.user), "connecting user must be a role");
}

#[tokio::test]
async fn unsupported_engine_errors() {
    let cfg = ConnectionConfig {
        engine: Engine::Mssql,
        host: "localhost".into(),
        port: 1433,
        user: "sa".into(),
        password: None,
        database: "master".into(),
        ssl_mode: None,
    };
    let err = PgClient::connect(&cfg).await.err().expect("should error");
    assert_eq!(err.kind(), "unsupported");
}
