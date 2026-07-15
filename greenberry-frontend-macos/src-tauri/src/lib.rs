pub mod db;

use std::collections::HashMap;

use db::{ActiveQueries, Catalog, ConnectionConfig, DbClient, DbError, QueryResult};
use serde::Serialize;
use tauri::State;
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

// --- OS keychain (S2.2): secrets live here, never in the workspace store ---

#[tauri::command]
fn secret_set(service: String, account: String, secret: String) -> Result<(), String> {
    keyring::Entry::new(&service, &account)
        .map_err(|e| e.to_string())?
        .set_password(&secret)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn secret_get(service: String, account: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(&service, &account).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(p) => Ok(Some(p)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn secret_delete(service: String, account: String) -> Result<(), String> {
    let entry = keyring::Entry::new(&service, &account).map_err(|e| e.to_string())?;
    match entry.delete_password() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(DbState::default())
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
            secret_set,
            secret_get,
            secret_delete
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
