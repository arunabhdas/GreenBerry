// Connection-string rendering (S10.5): the inverse of parseUrl.ts, used by
// the saved-connections panel. The UI always masks the password; the copy
// action uses the full string (secrets are stored with the row — ADR 0002).
import type { ConnectionConfig } from "../../lib/db";

const SCHEME: Record<ConnectionConfig["engine"], string> = {
  postgres: "postgres",
  mysql: "mysql",
  sqlite: "sqlite",
  mssql: "mssql",
};

export const PASSWORD_MASK = "•••";

export function buildConnectionUrl(
  config: ConnectionConfig,
  opts: { maskPassword?: boolean } = {},
): string {
  if (config.engine === "sqlite") {
    return `sqlite://${config.database}`;
  }
  let auth = "";
  if (config.user) {
    auth = encodeURIComponent(config.user);
    if (config.password) {
      auth += `:${opts.maskPassword ? PASSWORD_MASK : encodeURIComponent(config.password)}`;
    }
    auth += "@";
  }
  const ssl = config.sslMode ? `?sslmode=${config.sslMode}` : "";
  return `${SCHEME[config.engine]}://${auth}${config.host}:${config.port}/${config.database}${ssl}`;
}
