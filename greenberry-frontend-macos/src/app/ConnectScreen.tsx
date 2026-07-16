import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { db, type Catalog, type ConnectionConfig } from "../lib/db";
import { workspace, useWorkspace, type StoredConnection } from "../lib/workspace";
import { ConnectionModal } from "../features/connections/ConnectionModal";
import { EnvBadge } from "../features/connections/env";
import { Button } from "../ui/Button";
import { useTheme } from "../ui/theme";
import { useToast } from "../ui/Toast";

function msg(e: unknown): string {
  return e && typeof e === "object" && "message" in e
    ? String((e as { message: unknown }).message)
    : String(e);
}

export interface Session {
  connectionId: string;
  conn: StoredConnection;
  /** Resolved config (password attached) — kept in memory only, never stored.
      The workspace uses it to lazily open sibling databases in the tree. */
  config: ConnectionConfig;
  catalog: Catalog;
  /** Databases on the server (like `\list`). */
  databases: string[];
  /** Roles/users on the server (like `\du`). */
  roles: string[];
}

export function ConnectScreen({ onConnected }: { onConnected: (s: Session) => void }) {
  const { theme, toggleTheme } = useTheme();
  const { notify } = useToast();
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const recent = useWorkspace((s) => s.connections);

  async function connect(stored: StoredConnection, password?: string) {
    setBusy(true);
    try {
      // The stored row carries its password (app-db, ADR 0002) — no keychain.
      const config = password ? { ...stored.config, password } : stored.config;
      const connectionId = await db.connect(config);
      const catalog = await db.introspect(connectionId);
      // Server-level lists are best-effort — an empty result must not block
      // a successful connect (e.g. a restricted role can't read pg_roles).
      const [databases, roles] = await Promise.all([
        db.databases(connectionId).catch(() => [] as string[]),
        db.roles(connectionId).catch(() => [] as string[]),
      ]);
      onConnected({ connectionId, conn: stored, config, catalog, databases, roles });
    } catch (e) {
      notify(msg(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveAndConnect(stored: StoredConnection, password?: string) {
    // S11.2: persist the full descriptor — password included — to the app-db.
    const full = password
      ? { ...stored, config: { ...stored.config, password } }
      : stored;
    workspace.addConnection(full);
    setModal(false);
    await connect(full);
  }

  async function quickLocalPostgres() {
    const user = await invoke<string>("os_username").catch(() => "postgres");
    await connect({
      id: "local-pg",
      name: "Local Postgres",
      env: "local",
      config: { engine: "postgres", host: "localhost", port: 5432, user, database: "postgres" },
    });
  }

  return (
    <div className="app">
      <header className="titlebar" data-tauri-drag-region>
        <span className="brand">🫐 GreenBerry</span>
        <span className="sub">Desktop</span>
        <Button size="sm" variant="ghost" style={{ marginLeft: "auto" }} onClick={toggleTheme} aria-label="toggle theme">
          {theme === "dark" ? "☾" : "☀"}
        </Button>
      </header>

      <div className="gb-connect">
        <div className="gb-connect__card">
          <div className="mark">GreenBerry</div>
          <p style={{ color: "var(--dim)", marginTop: 8 }}>
            {busy ? "connecting…" : "Connect to a database to get started."}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
            <Button variant="primary" onClick={() => setModal(true)}>New Connection</Button>
            <Button onClick={quickLocalPostgres} disabled={busy}>Quick: Local Postgres</Button>
          </div>

          {recent.length > 0 && (
            <div className="gb-connect__recent">
              <div style={{ color: "var(--dim)", fontSize: "0.8rem" }}>Recent</div>
              {recent.map((c) => (
                <button key={c.id} onClick={() => connect(c)} disabled={busy}>
                  {c.name} <EnvBadge env={c.env} />{" "}
                  <span style={{ color: "var(--dim)" }}>· {c.config.engine}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {modal && <ConnectionModal onSave={saveAndConnect} onClose={() => setModal(false)} />}
    </div>
  );
}
