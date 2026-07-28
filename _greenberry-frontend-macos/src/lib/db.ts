// Typed client for the Rust DB command layer (S1.3).
// These types mirror src-tauri/src/db.rs (serde camelCase).
import { invoke } from "@tauri-apps/api/core";

export type Engine = "postgres" | "mysql" | "sqlite" | "mssql";

export interface ConnectionConfig {
  engine: Engine;
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  sslMode?: string;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
}

export interface QueryResult {
  columns: ColumnInfo[];
  rows: unknown[][];
  rowCount: number;
  rowsAffected: number;
  elapsedMs: number;
  truncated: boolean;
}

export interface ColumnRef {
  schema: string;
  table: string;
  column: string;
}

export interface ColumnMeta {
  name: string;
  dataType: string;
  nullable: boolean;
  primaryKey: boolean;
  references?: ColumnRef | null;
}

export interface TableMeta {
  name: string;
  kind: "table" | "view";
  columns: ColumnMeta[];
}

export interface SchemaMeta {
  name: string;
  tables: TableMeta[];
}

export interface Catalog {
  schemas: SchemaMeta[];
}

/** Shape of a rejected command (see DbError in db.rs). */
export interface DbError {
  kind: "connection" | "query" | "notConnected" | "unsupported";
  message: string;
}

let seq = 0;
/** Unique token for a query, so it can be cancelled. */
export function newToken(): string {
  seq += 1;
  return `q${seq}-${Math.round(performance.now())}`;
}

export const db = {
  connect: (config: ConnectionConfig) => invoke<string>("db_connect", { config }),

  disconnect: (connectionId: string) =>
    invoke<void>("db_disconnect", { connectionId }),

  query: (
    connectionId: string,
    sql: string,
    opts: { limit?: number; token?: string } = {},
  ) =>
    invoke<QueryResult>("db_query", {
      connectionId,
      sql,
      limit: opts.limit ?? null,
      token: opts.token ?? newToken(),
    }),

  cancel: (connectionId: string, token: string) =>
    invoke<boolean>("db_cancel", { connectionId, token }),

  introspect: (connectionId: string) =>
    invoke<Catalog>("db_introspect", { connectionId }),

  /** Databases on the server (like psql `\list`). */
  databases: (connectionId: string) =>
    invoke<string[]>("db_databases", { connectionId }),

  /** Roles/users on the server (like psql `\du`). */
  roles: (connectionId: string) =>
    invoke<string[]>("db_roles", { connectionId }),

  /** Apply staged statements atomically (S4.5). Returns rows affected. */
  execBatch: (connectionId: string, statements: string[]) =>
    invoke<number>("db_exec_batch", { connectionId, statements }),
};
