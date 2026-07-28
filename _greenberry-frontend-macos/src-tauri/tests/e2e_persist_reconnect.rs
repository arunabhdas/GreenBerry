//! End-to-end harness (S11.3, Rust-level): connect config → persist to the
//! real SQLite app-db → "restart" (drop + reopen) → reconnect from the stored
//! row → query → staged-edit commit → history recorded.
//!
//! Uses a live Postgres; skipped unless `GB_TEST_PG_USER` is set (same gate
//! as db_pg.rs). Run locally with:
//!   GB_TEST_PG_USER=$USER cargo test --test e2e_persist_reconnect -- --nocapture
use std::collections::HashMap;

use greenberry_frontend_macos_lib::appdb::{AppDb, HistoryItem, StoredConfig, StoredConnection};
use greenberry_frontend_macos_lib::db::{ConnectionConfig, DbClient, Engine};
use tokio::sync::Mutex;

fn env_connection() -> Option<StoredConnection> {
    let user = std::env::var("GB_TEST_PG_USER").ok()?;
    Some(StoredConnection {
        id: "e2e-pg".into(),
        name: "E2E Postgres".into(),
        env: "local".into(),
        config: StoredConfig {
            engine: "postgres".into(),
            host: std::env::var("GB_TEST_PG_HOST").unwrap_or_else(|_| "localhost".into()),
            port: std::env::var("GB_TEST_PG_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(5432),
            user,
            password: std::env::var("GB_TEST_PG_PASSWORD").ok(),
            database: std::env::var("GB_TEST_PG_DB").unwrap_or_else(|_| "postgres".into()),
            ssl_mode: None,
        },
    })
}

/// The same mapping the frontend does when reconnecting a stored row.
fn to_config(c: &StoredConfig) -> ConnectionConfig {
    ConnectionConfig {
        engine: match c.engine.as_str() {
            "mysql" => Engine::Mysql,
            "sqlite" => Engine::Sqlite,
            "mssql" => Engine::Mssql,
            _ => Engine::Postgres,
        },
        host: c.host.clone(),
        port: c.port,
        user: c.user.clone(),
        password: c.password.clone(),
        database: c.database.clone(),
        ssl_mode: c.ssl_mode.clone(),
    }
}

#[tokio::test]
async fn persist_restart_reconnect_query_commit() {
    let Some(stored) = env_connection() else {
        eprintln!("skipping e2e: set GB_TEST_PG_USER to run");
        return;
    };
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("greenberry.db");

    // 1. first launch: save the connection (password included — ADR 0002)
    {
        let appdb = AppDb::open(&path).await.expect("open app-db");
        appdb.save_connection(&stored).await.expect("persist");
    } // drop = app quit

    // 2. restart: reload the connection from disk
    let appdb = AppDb::open(&path).await.expect("reopen app-db");
    let conns = appdb.list_connections().await.expect("list");
    let reloaded = conns.iter().find(|c| c.id == "e2e-pg").expect("stored row");
    assert_eq!(reloaded.config.password, stored.config.password);

    // 3. reconnect from the stored row
    let client = DbClient::connect(&to_config(&reloaded.config))
        .await
        .expect("reconnect from stored config");
    client.ping().await.expect("ping");

    // 4. query
    let active = Mutex::new(HashMap::new());
    let r = client
        .run_query("SELECT 42 AS answer", 10, &active, "e2e-q1")
        .await
        .expect("query");
    assert_eq!(r.rows[0][0], serde_json::json!(42));

    // 5. staged-edit commit: one transaction, like the grid's commit bar
    client
        .run_query("DROP TABLE IF EXISTS _gb_e2e", 1, &active, "e2e-d0")
        .await
        .ok();
    client
        .run_query(
            "CREATE TABLE _gb_e2e (id int primary key, v text)",
            1,
            &active,
            "e2e-c0",
        )
        .await
        .expect("create");
    let affected = client
        .exec_batch(&[
            "INSERT INTO _gb_e2e (id, v) VALUES (1, 'a')".into(),
            "UPDATE _gb_e2e SET v = 'edited' WHERE id = 1".into(),
        ])
        .await
        .expect("staged commit");
    assert_eq!(affected, 2);
    let check = client
        .run_query("SELECT v FROM _gb_e2e WHERE id = 1", 10, &active, "e2e-q2")
        .await
        .expect("verify");
    assert_eq!(check.rows[0][0], serde_json::json!("edited"));
    client
        .run_query("DROP TABLE _gb_e2e", 1, &active, "e2e-z0")
        .await
        .ok();

    // 6. history lands in the app-db and survives another reopen
    appdb
        .add_history(&HistoryItem {
            id: "e2e-h1".into(),
            sql: "SELECT 42 AS answer".into(),
            ts: 1,
            status: "ok".into(),
            duration_ms: Some(r.elapsed_ms),
        })
        .await
        .expect("history");
    drop(appdb);
    let appdb = AppDb::open(&path).await.expect("reopen again");
    let hist = appdb.list_history(10).await.expect("list history");
    assert_eq!(hist.len(), 1);
    assert_eq!(hist[0].status, "ok");
}
