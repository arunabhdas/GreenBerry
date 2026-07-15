// Credential handling (S2.2). Passwords never touch the persisted workspace
// store — they go to the OS keychain (Rust `secret_*` commands). We persist a
// sanitized config plus a `hasSecret` flag.
import { invoke } from "@tauri-apps/api/core";
import type { ConnectionConfig } from "../../lib/db";

const SERVICE = "com.greenberry.desktop";

export const secrets = {
  set: (account: string, secret: string) =>
    invoke<void>("secret_set", { service: SERVICE, account, secret }),
  get: (account: string) =>
    invoke<string | null>("secret_get", { service: SERVICE, account }),
  delete: (account: string) =>
    invoke<void>("secret_delete", { service: SERVICE, account }),
};

/** Strip the password so it is never written to the persisted workspace. */
export function sanitizeForStore(config: ConnectionConfig): {
  config: ConnectionConfig;
  hasSecret: boolean;
} {
  const { password, ...rest } = config;
  return { config: rest as ConnectionConfig, hasSecret: Boolean(password) };
}

/** Re-attach the password (from the keychain) before connecting. */
export async function withSecret(
  storedId: string,
  config: ConnectionConfig,
): Promise<ConnectionConfig> {
  if (config.password) return config;
  const password = await secrets.get(storedId).catch(() => null);
  return password ? { ...config, password } : config;
}
