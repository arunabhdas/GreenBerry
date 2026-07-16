// S3.7: SQL text of open query tabs, persisted in the SQLite app-db so it
// survives tab switches and app restarts. Rows are deleted when the tab
// closes. All calls are best-effort — a missing app-db (unit tests, plain
// browser) must never break the editor.
import { invoke } from "@tauri-apps/api/core";

export interface OpenQuery {
  id: string;
  connId: string;
  db: string;
  sql: string;
}

export const openQueries = {
  list: (connId: string) =>
    invoke<OpenQuery[]>("store_list_open_queries", { connId }).catch(
      () => [] as OpenQuery[],
    ),
  save: (query: OpenQuery) =>
    invoke<void>("store_save_open_query", { query }).catch(() => {}),
  remove: (id: string) =>
    invoke<void>("store_delete_open_query", { id }).catch(() => {}),
};
