//! App-db integration tests (S10.1/S10.3). Pure SQLite in a temp dir —
//! always runs, no external services needed.
use greenberry_frontend_macos_lib::appdb::{
    AppDb, Dashboard, HistoryItem, SavedQuery, StoredConfig, StoredConnection,
};

fn conn(id: &str, password: Option<&str>) -> StoredConnection {
    StoredConnection {
        id: id.into(),
        name: format!("Conn {id}"),
        env: "local".into(),
        config: StoredConfig {
            engine: "postgres".into(),
            host: "localhost".into(),
            port: 5432,
            user: "coder".into(),
            password: password.map(Into::into),
            database: "postgres".into(),
            ssl_mode: None,
        },
    }
}

#[tokio::test]
async fn connections_roundtrip_and_survive_reopen() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("greenberry.db");

    {
        let db = AppDb::open(&path).await.unwrap();
        db.save_connection(&conn("a", Some("s3cret"))).await.unwrap();
        db.save_connection(&conn("b", None)).await.unwrap();
        // upsert replaces, not duplicates
        let mut updated = conn("a", Some("n3w"));
        updated.name = "Renamed".into();
        db.save_connection(&updated).await.unwrap();
    } // drop = app quit

    let db = AppDb::open(&path).await.unwrap(); // restart
    let list = db.list_connections().await.unwrap();
    assert_eq!(list.len(), 2);
    let a = list.iter().find(|c| c.id == "a").unwrap();
    assert_eq!(a.name, "Renamed");
    assert_eq!(a.config.password.as_deref(), Some("n3w")); // password persisted (ADR 0002)

    db.delete_connection("b").await.unwrap();
    assert_eq!(db.list_connections().await.unwrap().len(), 1);
}

#[cfg(unix)]
#[tokio::test]
async fn app_db_file_is_user_only() {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("greenberry.db");
    AppDb::open(&path).await.unwrap();
    let mode = std::fs::metadata(&path).unwrap().permissions().mode();
    assert_eq!(mode & 0o777, 0o600, "secrets rest in this file — must be 0600");
}

#[tokio::test]
async fn history_caps_at_500_newest() {
    let dir = tempfile::tempdir().unwrap();
    let db = AppDb::open(&dir.path().join("g.db")).await.unwrap();
    for i in 0..510 {
        db.add_history(&HistoryItem {
            id: format!("h{i}"),
            sql: "SELECT 1".into(),
            ts: i,
            status: "ok".into(),
            duration_ms: Some(1.0),
        })
        .await
        .unwrap();
    }
    let items = db.list_history(1000).await.unwrap();
    assert_eq!(items.len(), 500);
    assert_eq!(items[0].ts, 509); // newest first, oldest evicted
    assert!(items.iter().all(|h| h.ts >= 10));
}

#[tokio::test]
async fn saved_queries_dashboards_and_kv_roundtrip() {
    let dir = tempfile::tempdir().unwrap();
    let db = AppDb::open(&dir.path().join("g.db")).await.unwrap();

    let q = SavedQuery {
        id: "q1".into(),
        name: "Top users".into(),
        sql: "SELECT * FROM users".into(),
        folder: Some("reports".into()),
    };
    db.save_query(&q).await.unwrap();
    assert_eq!(db.list_queries().await.unwrap(), vec![q]);
    db.delete_query("q1").await.unwrap();
    assert!(db.list_queries().await.unwrap().is_empty());

    let d = Dashboard {
        id: "d1".into(),
        name: "Ops".into(),
        payload: r#"{"widgets":[]}"#.into(),
    };
    db.save_dashboard(&d).await.unwrap();
    assert_eq!(db.list_dashboards().await.unwrap(), vec![d]);

    assert_eq!(db.get_kv("settings").await.unwrap(), None);
    db.set_kv("settings", r#"{"theme":"dark"}"#).await.unwrap();
    db.set_kv("settings", r#"{"theme":"light"}"#).await.unwrap();
    assert_eq!(
        db.get_kv("settings").await.unwrap().as_deref(),
        Some(r#"{"theme":"light"}"#)
    );
}
