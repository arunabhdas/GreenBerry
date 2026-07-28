// Admin surface builders (E8): sessions, kill, roles/grants, maintenance,
// metrics, and pg_dump args. Pure/engine-aware; executed via the query path.
import type { Engine } from "../../lib/db";
import type { ConnectionConfig } from "../../lib/db";
import { quoteIdent } from "../grid/sqlBuilder";

// S8.1 — sessions / activity
export function buildSessionsQuery(engine: Engine): string {
  if (engine === "postgres") {
    return (
      "SELECT pid, usename AS user, state, wait_event_type AS wait, query, " +
      "EXTRACT(EPOCH FROM (now() - query_start)) AS duration_s " +
      "FROM pg_stat_activity WHERE pid <> pg_backend_pid() ORDER BY query_start"
    );
  }
  if (engine === "mysql") {
    return (
      "SELECT id AS pid, user, command AS state, time AS duration_s, info AS query " +
      "FROM information_schema.processlist ORDER BY time DESC"
    );
  }
  return "SELECT NULL AS pid WHERE 1=0"; // sqlite: no server sessions
}

export function buildKillQuery(
  engine: Engine,
  pid: number,
  terminate = false,
): string {
  if (engine === "postgres") {
    return `SELECT ${terminate ? "pg_terminate_backend" : "pg_cancel_backend"}(${pid});`;
  }
  if (engine === "mysql") {
    return `KILL ${terminate ? "" : "QUERY "}${pid};`;
  }
  return "";
}

// S8.2 — roles & permissions
export interface GrantSpec {
  privileges: string[];
  onObject: string; // already-qualified object, e.g. `"public"."users"`
  role: string;
}
export function buildGrant(engine: Engine, g: GrantSpec): string {
  return `GRANT ${g.privileges.join(", ")} ON ${g.onObject} TO ${quoteIdent(engine, g.role)};`;
}
export function buildRevoke(engine: Engine, g: GrantSpec): string {
  return `REVOKE ${g.privileges.join(", ")} ON ${g.onObject} FROM ${quoteIdent(engine, g.role)};`;
}

// S8.3 — maintenance + backup args
export type Maintenance = "vacuum" | "analyze" | "vacuum-analyze" | "reindex";
export function buildMaintenance(
  engine: Engine,
  op: Maintenance,
  table: string,
): string {
  const t = quoteIdent(engine, table);
  if (engine === "postgres") {
    return {
      vacuum: `VACUUM ${t};`,
      analyze: `ANALYZE ${t};`,
      "vacuum-analyze": `VACUUM ANALYZE ${t};`,
      reindex: `REINDEX TABLE ${t};`,
    }[op];
  }
  if (engine === "mysql") {
    return op === "analyze" ? `ANALYZE TABLE ${t};` : `OPTIMIZE TABLE ${t};`;
  }
  return "VACUUM;"; // sqlite
}

export function buildPgDumpArgs(
  config: ConnectionConfig,
  opts: { format?: "plain" | "custom"; file: string },
): string[] {
  const args = [
    "-h",
    config.host,
    "-p",
    String(config.port),
    "-U",
    config.user,
    "-d",
    config.database,
    "-F",
    opts.format === "custom" ? "c" : "p",
    "-f",
    opts.file,
  ];
  return args;
}

// S8.4 — server metrics
export function buildMetricsQuery(engine: Engine): string {
  if (engine === "postgres") {
    return (
      "SELECT datname AS db, numbackends AS connections, xact_commit AS commits, " +
      "xact_rollback AS rollbacks, blks_read, blks_hit, pg_database_size(datname) AS size_bytes " +
      "FROM pg_stat_database WHERE datname IS NOT NULL ORDER BY numbackends DESC"
    );
  }
  return "SELECT NULL WHERE 1=0";
}
