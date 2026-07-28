//! MySQL adapter integration tests (S2.7). Skipped unless `GB_TEST_MYSQL_USER`
//! is set. Run locally with e.g.
//!   GB_TEST_MYSQL_USER=root GB_TEST_MYSQL_DB=gbtest cargo test --test db_mysql
use std::collections::HashMap;

use greenberry_frontend_macos_lib::db::{ConnectionConfig, Engine, MyClient};
use tokio::sync::Mutex;

fn env_cfg() -> Option<ConnectionConfig> {
    let user = std::env::var("GB_TEST_MYSQL_USER").ok()?;
    Some(ConnectionConfig {
        engine: Engine::Mysql,
        host: std::env::var("GB_TEST_MYSQL_HOST").unwrap_or_else(|_| "localhost".into()),
        port: std::env::var("GB_TEST_MYSQL_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(3306),
        user,
        password: std::env::var("GB_TEST_MYSQL_PASSWORD").ok(),
        database: std::env::var("GB_TEST_MYSQL_DB").unwrap_or_else(|_| "gbtest".into()),
        ssl_mode: None,
    })
}

#[tokio::test]
async fn mysql_query_introspect_batch() {
    let Some(cfg) = env_cfg() else {
        eprintln!("skipping db_mysql: set GB_TEST_MYSQL_USER to run");
        return;
    };
    let client = MyClient::connect(&cfg).await.expect("connect");
    let active = Mutex::new(HashMap::new());

    // idempotent: clear rows a prior run may have left behind
    let _ = client
        .run_query("DELETE FROM gb_child WHERE parent_id IN (2,3)", 10, &active, "m0a")
        .await;
    let _ = client
        .run_query("DELETE FROM gb_parent WHERE id IN (2,3)", 10, &active, "m0b")
        .await;

    // typed JSON values
    let r = client
        .run_query("SELECT 1 AS n, 'hi' AS s", 100, &active, "m1")
        .await
        .expect("query");
    assert_eq!(r.columns.len(), 2);
    assert_eq!(r.columns[0].name, "n");
    assert_eq!(r.row_count, 1);
    assert_eq!(r.rows[0][0], serde_json::json!(1));
    assert_eq!(r.rows[0][1], serde_json::json!("hi"));

    // limit + truncation
    let r2 = client
        .run_query(
            "SELECT 1 AS x UNION ALL SELECT 2 UNION ALL SELECT 3",
            2,
            &active,
            "m2",
        )
        .await
        .expect("query2");
    assert_eq!(r2.row_count, 2);
    assert!(r2.truncated);

    // exec_batch commit
    let n = client
        .exec_batch(&["INSERT INTO gb_parent (id, name) VALUES (2, 'two')".into()])
        .await
        .expect("insert");
    assert_eq!(n, 1);

    // failing batch rolls back
    let err = client
        .exec_batch(&[
            "INSERT INTO gb_parent (id, name) VALUES (3, 'x')".into(),
            "INSERT INTO gb_parent (id, name) VALUES (2, 'dup')".into(), // dup pk → fails
        ])
        .await;
    assert!(err.is_err());
    let c = client
        .run_query("SELECT COUNT(*) AS c FROM gb_parent WHERE id = 3", 10, &active, "m3")
        .await
        .unwrap();
    assert_eq!(c.rows[0][0], serde_json::json!(0)); // id=3 rolled back

    // FK introspection
    let cat = client.introspect().await.expect("introspect");
    let child = cat
        .schemas
        .iter()
        .flat_map(|s| &s.tables)
        .find(|t| t.name == "gb_child")
        .expect("gb_child");
    let fk = child
        .columns
        .iter()
        .find(|c| c.name == "parent_id")
        .expect("parent_id");
    assert_eq!(fk.references.as_ref().expect("fk ref").table, "gb_parent");

    // cleanup
    let _ = client
        .run_query("DELETE FROM gb_parent WHERE id = 2", 10, &active, "m4")
        .await;
}
