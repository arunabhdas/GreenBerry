pub mod appdb;
pub mod db;

use std::collections::HashMap;

use appdb::{AppDb, Dashboard, HistoryItem, OpenQuery, SavedQuery, StoredConnection};
use db::{ActiveQueries, Catalog, ConnectionConfig, DbClient, DbError, QueryResult};
use serde::Serialize;
use tauri::{Manager, State};
use tokio::sync::Mutex;

#[derive(Serialize)]
struct AppInfo {
    name: String,
    version: String,
    tauri: String,
}

#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo {
        name: "GreenBerry".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        tauri: "2".into(),
    }
}

#[tauri::command]
fn os_username() -> String {
    std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_default()
}

/// Live connections + in-flight query registry, shared across commands.
#[derive(Default)]
struct DbState {
    conns: Mutex<HashMap<String, DbClient>>,
    active: ActiveQueries,
}

async fn client(state: &State<'_, DbState>, id: &str) -> Result<DbClient, DbError> {
    state
        .conns
        .lock()
        .await
        .get(id)
        .cloned()
        .ok_or_else(|| DbError::NotConnected(id.to_string()))
}

#[tauri::command]
async fn db_connect(state: State<'_, DbState>, config: ConnectionConfig) -> Result<String, DbError> {
    let client = DbClient::connect(&config).await?;
    client.ping().await?;
    let id = uuid::Uuid::new_v4().to_string();
    state.conns.lock().await.insert(id.clone(), client);
    Ok(id)
}

#[tauri::command]
async fn db_disconnect(state: State<'_, DbState>, connection_id: String) -> Result<(), DbError> {
    state.conns.lock().await.remove(&connection_id);
    Ok(())
}

#[tauri::command]
async fn db_query(
    state: State<'_, DbState>,
    connection_id: String,
    sql: String,
    limit: Option<i64>,
    token: String,
) -> Result<QueryResult, DbError> {
    let client = client(&state, &connection_id).await?;
    client
        .run_query(&sql, limit.unwrap_or(1000), &state.active, &token)
        .await
}

#[tauri::command]
async fn db_cancel(
    state: State<'_, DbState>,
    connection_id: String,
    token: String,
) -> Result<bool, DbError> {
    let pid = state.active.lock().await.get(&token).copied();
    match pid {
        Some(pid) => client(&state, &connection_id).await?.cancel(pid).await,
        None => Ok(false),
    }
}

#[tauri::command]
async fn db_introspect(
    state: State<'_, DbState>,
    connection_id: String,
) -> Result<Catalog, DbError> {
    client(&state, &connection_id).await?.introspect().await
}

#[tauri::command]
async fn db_exec_batch(
    state: State<'_, DbState>,
    connection_id: String,
    statements: Vec<String>,
) -> Result<u64, DbError> {
    client(&state, &connection_id)
        .await?
        .exec_batch(&statements)
        .await
}

/// Databases on the server (like psql `\list`).
#[tauri::command]
async fn db_databases(
    state: State<'_, DbState>,
    connection_id: String,
) -> Result<Vec<String>, DbError> {
    client(&state, &connection_id).await?.list_databases().await
}

/// Roles/users on the server (like psql `\du`).
#[tauri::command]
async fn db_roles(
    state: State<'_, DbState>,
    connection_id: String,
) -> Result<Vec<String>, DbError> {
    client(&state, &connection_id).await?.list_roles().await
}

// --- App-db persistence (S10.1/S10.3): connections (incl. password — ADR
// 0002), saved queries, history, dashboards, settings live in local SQLite.

#[tauri::command]
async fn store_list_connections(db: State<'_, AppDb>) -> Result<Vec<StoredConnection>, DbError> {
    db.list_connections().await
}

#[tauri::command]
async fn store_save_connection(
    db: State<'_, AppDb>,
    conn: StoredConnection,
) -> Result<(), DbError> {
    db.save_connection(&conn).await
}

#[tauri::command]
async fn store_delete_connection(db: State<'_, AppDb>, id: String) -> Result<(), DbError> {
    db.delete_connection(&id).await
}

#[tauri::command]
async fn store_add_history(db: State<'_, AppDb>, item: HistoryItem) -> Result<(), DbError> {
    db.add_history(&item).await
}

#[tauri::command]
async fn store_list_history(
    db: State<'_, AppDb>,
    limit: Option<i64>,
) -> Result<Vec<HistoryItem>, DbError> {
    db.list_history(limit.unwrap_or(500)).await
}

#[tauri::command]
async fn store_save_query(db: State<'_, AppDb>, query: SavedQuery) -> Result<(), DbError> {
    db.save_query(&query).await
}

#[tauri::command]
async fn store_list_queries(db: State<'_, AppDb>) -> Result<Vec<SavedQuery>, DbError> {
    db.list_queries().await
}

#[tauri::command]
async fn store_delete_query(db: State<'_, AppDb>, id: String) -> Result<(), DbError> {
    db.delete_query(&id).await
}

#[tauri::command]
async fn store_save_dashboard(db: State<'_, AppDb>, dashboard: Dashboard) -> Result<(), DbError> {
    db.save_dashboard(&dashboard).await
}

#[tauri::command]
async fn store_list_dashboards(db: State<'_, AppDb>) -> Result<Vec<Dashboard>, DbError> {
    db.list_dashboards().await
}

// S3.7: SQL text of open query tabs — saved on edit, removed on tab close.
#[tauri::command]
async fn store_save_open_query(db: State<'_, AppDb>, query: OpenQuery) -> Result<(), DbError> {
    db.save_open_query(&query).await
}

#[tauri::command]
async fn store_list_open_queries(
    db: State<'_, AppDb>,
    conn_id: String,
) -> Result<Vec<OpenQuery>, DbError> {
    db.list_open_queries(&conn_id).await
}

#[tauri::command]
async fn store_delete_open_query(db: State<'_, AppDb>, id: String) -> Result<(), DbError> {
    db.delete_open_query(&id).await
}

#[tauri::command]
async fn store_get_kv(db: State<'_, AppDb>, key: String) -> Result<Option<String>, DbError> {
    db.get_kv(&key).await
}

#[tauri::command]
async fn store_set_kv(db: State<'_, AppDb>, key: String, value: String) -> Result<(), DbError> {
    db.set_kv(&key, &value).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(DbState::default())
        .setup(|app| {
            // S10.1: open the app-db at the platform app-data path
            // (~/Library/Application Support/com.greenberry.desktop/greenberry.db).
            let path = app.path().app_data_dir()?.join("greenberry.db");
            let appdb = tauri::async_runtime::block_on(AppDb::open(&path))?;
            app.manage(appdb);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_info,
            os_username,
            db_connect,
            db_disconnect,
            db_query,
            db_cancel,
            db_introspect,
            db_exec_batch,
            db_databases,
            db_roles,
            store_list_connections,
            store_save_connection,
            store_delete_connection,
            store_add_history,
            store_list_history,
            store_save_query,
            store_list_queries,
            store_delete_query,
            store_save_dashboard,
            store_list_dashboards,
            store_save_open_query,
            store_list_open_queries,
            store_delete_open_query,
            store_get_kv,
            store_set_kv
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
