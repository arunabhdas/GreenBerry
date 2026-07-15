// Connection URL paste-import (S2.6). Parses postgres/mysql/sqlite/mssql URLs
// into a partial ConnectionConfig. Uses http-normalization so non-special
// schemes (postgres://) parse reliably via the WHATWG URL API.
import type { ConnectionConfig, Engine } from "../../lib/db";

const SCHEME_ENGINE: Record<string, Engine> = {
  postgres: "postgres",
  postgresql: "postgres",
  mysql: "mysql",
  mariadb: "mysql",
  sqlite: "sqlite",
  sqlite3: "sqlite",
  sqlserver: "mssql",
  mssql: "mssql",
};

const DEFAULT_PORT: Record<Engine, number> = {
  postgres: 5432,
  mysql: 3306,
  mssql: 1433,
  sqlite: 0,
};

export function parseConnectionUrl(input: string): Partial<ConnectionConfig> {
  const trimmed = input.trim();
  const schemeMatch = /^([a-z0-9+]+):\/\//i.exec(trimmed);
  if (!schemeMatch) throw new Error("not a connection URL");
  const scheme = schemeMatch[1].toLowerCase();
  const engine = SCHEME_ENGINE[scheme];
  if (!engine) throw new Error(`unknown engine: ${scheme}`);

  const out: Partial<ConnectionConfig> = { engine };

  // SQLite is a file path, not an authority — parse it from the raw string,
  // since the http-normalization below would collapse `sqlite:///abs/path`.
  if (engine === "sqlite") {
    const afterScheme = trimmed.slice(scheme.length + 1);
    let path: string;
    if (afterScheme.startsWith("//")) {
      const rest = afterScheme.slice(2);
      const slash = rest.indexOf("/");
      path = slash >= 0 ? rest.slice(slash) : rest;
    } else {
      path = afterScheme;
    }
    path = decodeURIComponent(path);
    if (path) out.database = path;
    return out;
  }

  const u = new URL(trimmed.replace(/^[a-z0-9+]+:\/\//i, "http://"));
  if (u.hostname) out.host = u.hostname;
  out.port = u.port ? Number(u.port) : DEFAULT_PORT[engine];
  if (u.username) out.user = decodeURIComponent(u.username);
  if (u.password) out.password = decodeURIComponent(u.password);
  const db = decodeURIComponent((u.pathname || "").replace(/^\//, ""));
  if (db) out.database = db;
  const ssl = u.searchParams.get("sslmode") ?? u.searchParams.get("ssl");
  if (ssl) out.sslMode = ssl;

  return out;
}
