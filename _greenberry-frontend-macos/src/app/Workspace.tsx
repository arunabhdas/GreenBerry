import { useEffect, useMemo, useRef, useState } from "react";
import type { Catalog, ConnectionConfig } from "../lib/db";
import { db } from "../lib/db";
import { openQueries } from "../lib/openQueries";
import { workspace, useWorkspace, type StoredConnection } from "../lib/workspace";
import { Sidebar, type DbNodeInfo, type ServerNodeInfo } from "../features/nav/Sidebar";
import { Tabs } from "../ui/Tabs";
import { Palette, type PaletteItem } from "../features/nav/Palette";
import { EnvBadge } from "../features/connections/env";
import { ConnectionModal } from "../features/connections/ConnectionModal";
import { SavedConnectionList } from "../features/connections/SavedList";
import { useShortcuts } from "../lib/shortcuts";
import { useTheme } from "../ui/theme";
import { useToast } from "../ui/Toast";
import { Button } from "../ui/Button";
import { BerryMark } from "../ui/BerryMark";
import { BrandLogo } from "../ui/BrandLogo";
import { TableView } from "./TableView";
import { QueryView } from "./QueryView";
import { DbPool, type DbEntry } from "./dbPool";

function msg(e: unknown): string {
  return e && typeof e === "object" && "message" in e
    ? String((e as { message: unknown }).message)
    : String(e);
}

type WsTab =
  | { id: string; kind: "table"; title: string; connId: string; db: string; schema: string; table: string }
  | { id: string; kind: "query"; title: string; connId: string; db: string; sql?: string };

/** One open server (S3.8 multi-server): its own pool, databases, roles. */
interface ServerSession {
  conn: StoredConnection;
  config: ConnectionConfig;
  databases: string[];
  roles: string[];
  entries: Record<string, DbEntry>;
}

export function Workspace({
  conn,
  config,
  initialConnectionId,
  initialCatalog,
  databases,
  roles,
  onDisconnect,
}: {
  conn: StoredConnection;
  /** Resolved config (password attached) used to open sibling databases. */
  config: ConnectionConfig;
  initialConnectionId: string;
  initialCatalog: Catalog;
  /** Every database on the initial server (like `\list`). */
  databases: string[];
  /** Initial server roles (like `\du`). */
  roles: string[];
  onDisconnect: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const { notify } = useToast();
  const [tabs, setTabs] = useState<WsTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<StoredConnection | null>(null);
  const [connPanelOpen, setConnPanelOpen] = useState(true);
  // where new query tabs land: the last-browsed server + database
  const [activeTarget, setActiveTarget] = useState({ connId: conn.id, db: config.database });
  const savedConnections = useWorkspace((s) => s.connections);
  // ids whose status dot is flashing red mid-disconnect (before settling gray)
  const [disconnecting, setDisconnecting] = useState<Set<string>>(() => new Set());
  const disconnectTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const poolsRef = useRef(new Map<string, DbPool>());
  const poolDeps = (cfg: ConnectionConfig) => ({
    connect: (database: string) => db.connect({ ...cfg, database }),
    introspect: (connectionId: string) => db.introspect(connectionId),
    disconnect: (connectionId: string) => db.disconnect(connectionId),
  });

  const [sessions, setSessions] = useState<Record<string, ServerSession>>(() => {
    const pool = new DbPool(poolDeps(config));
    pool.seed(config.database, initialConnectionId, initialCatalog);
    poolsRef.current.set(conn.id, pool);
    return { [conn.id]: { conn, config, databases, roles, entries: pool.snapshot() } };
  });
  // (re)attach pool listeners; setSessions is stable so this is idempotent
  useEffect(() => {
    for (const [id, pool] of poolsRef.current) {
      pool.onChange = (snap) =>
        setSessions((s) => (s[id] ? { ...s, [id]: { ...s[id], entries: snap } } : s));
    }
  });

  // --- S3.7: query-tab SQL persistence -------------------------------
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const SAVE_DEBOUNCE_MS = 400;

  /** Update a query tab's sql/db in memory and schedule the app-db upsert. */
  function updateQueryTab(id: string, patch: { sql?: string; db?: string }) {
    setTabs((ts) =>
      ts.map((t) => (t.id === id && t.kind === "query" ? { ...t, ...patch } : t)),
    );
    const pending = saveTimers.current.get(id);
    if (pending) clearTimeout(pending);
    saveTimers.current.set(
      id,
      setTimeout(() => {
        saveTimers.current.delete(id);
        const tab = tabsRef.current.find((t) => t.id === id);
        if (tab?.kind !== "query") return;
        void openQueries.save({ id, connId: tab.connId, db: tab.db, sql: tab.sql ?? "" });
      }, SAVE_DEBOUNCE_MS),
    );
  }

  /** Reopen a server's persisted query tabs (app restart / server reopen). */
  async function restoreOpenQueries(connId: string) {
    const rows = await openQueries.list(connId);
    if (!rows.length) return;
    setTabs((ts) => {
      const seen = new Set(ts.map((t) => t.id));
      const restored = rows
        .filter((r) => !seen.has(r.id))
        .map((r) => ({ id: r.id, kind: "query" as const, title: "Query", connId, db: r.db, sql: r.sql }));
      return [...ts, ...restored];
    });
  }

  useEffect(() => {
    void restoreOpenQueries(conn.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // clear pending disconnect flashes if the workspace unmounts
  useEffect(() => {
    const timers = disconnectTimers.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
    };
  }, []);

  // --- S3.8: multi-server sessions ------------------------------------
  async function openServer(stored: StoredConnection) {
    if (poolsRef.current.has(stored.id)) return; // already open
    try {
      const cfg = stored.config;
      const connectionId = await db.connect(cfg);
      const catalog = await db.introspect(connectionId);
      const [dbs, srvRoles] = await Promise.all([
        db.databases(connectionId).catch(() => [] as string[]),
        db.roles(connectionId).catch(() => [] as string[]),
      ]);
      const pool = new DbPool(poolDeps(cfg));
      pool.seed(cfg.database, connectionId, catalog);
      poolsRef.current.set(stored.id, pool);
      setSessions((s) => ({
        ...s,
        [stored.id]: { conn: stored, config: cfg, databases: dbs, roles: srvRoles, entries: pool.snapshot() },
      }));
      setActiveTarget({ connId: stored.id, db: cfg.database });
      // reconnecting cancels any pending red→gray flash for this id
      const t = disconnectTimers.current.get(stored.id);
      if (t) {
        clearTimeout(t);
        disconnectTimers.current.delete(stored.id);
      }
      setDisconnecting((d) => {
        if (!d.has(stored.id)) return d;
        const n = new Set(d);
        n.delete(stored.id);
        return n;
      });
      void restoreOpenQueries(stored.id);
    } catch (e) {
      notify(`Could not open “${stored.name}”: ${msg(e)}`, "error");
    }
  }

  /** Disconnect one server: close its pools, drop its tabs, and flash the
   *  status dot red → gray. The user stays in the workspace — no navigation —
   *  so they can reconnect this or another connection from the panel. Persisted
   *  SQL rows remain. Persisted-query rows remain. */
  function disconnectServer(connId: string) {
    const pool = poolsRef.current.get(connId);
    if (!pool) return;
    poolsRef.current.delete(connId);
    void pool.disconnectAll();
    setTabs((ts) => {
      const next = ts.filter((t) => t.connId !== connId);
      if (!next.some((t) => t.id === activeId)) setActiveId(next[0]?.id ?? null);
      return next;
    });
    setSessions((s) => {
      const { [connId]: _closed, ...rest } = s;
      return rest;
    });
    setActiveTarget((t) => {
      if (t.connId !== connId) return t;
      const other = Object.values(sessions).find((x) => x.conn.id !== connId);
      return other ? { connId: other.conn.id, db: other.config.database } : t;
    });

    // flash the connection's status dot red, then let it settle to gray
    setDisconnecting((d) => new Set(d).add(connId));
    const prev = disconnectTimers.current.get(connId);
    if (prev) clearTimeout(prev);
    disconnectTimers.current.set(
      connId,
      setTimeout(() => {
        disconnectTimers.current.delete(connId);
        setDisconnecting((d) => {
          const n = new Set(d);
          n.delete(connId);
          return n;
        });
      }, 900),
    );

    // Only leave the workspace if there is nothing left to reconnect to.
    if (poolsRef.current.size === 0 && savedConnections.length === 0) onDisconnect();
  }

  /** Top-right "Disconnect": close the connection currently in focus (or any
   *  live one if focus has drifted), staying on this screen. */
  function disconnectActive() {
    const connId = poolsRef.current.has(activeTarget.connId)
      ? activeTarget.connId
      : poolsRef.current.keys().next().value;
    if (connId) disconnectServer(connId);
  }

  // --- tabs ------------------------------------------------------------
  function openTable(connId: string, database: string, schema: string, table: string) {
    const id = `t:${connId}:${database}.${schema}.${table}`;
    setTabs((ts) =>
      ts.some((t) => t.id === id)
        ? ts
        : [...ts, { id, kind: "table", title: table, connId, db: database, schema, table }],
    );
    setActiveId(id);
    setActiveTarget({ connId, db: database });
  }
  function openQuery(sql?: string, target?: { connId: string; db: string }) {
    const t = target ?? activeTarget;
    const id = `q:${Date.now()}`;
    setTabs((ts) => [...ts, { id, kind: "query", title: "Query", connId: t.connId, db: t.db, sql }]);
    setActiveId(id);
  }
  function closeTab(id: string) {
    // S3.7: a closed query tab releases its persisted SQL
    const closing = tabsRef.current.find((t) => t.id === id);
    if (closing?.kind === "query") {
      const pending = saveTimers.current.get(id);
      if (pending) clearTimeout(pending);
      saveTimers.current.delete(id);
      void openQueries.remove(id);
    }
    setTabs((ts) => {
      const idx = ts.findIndex((t) => t.id === id);
      const next = ts.filter((t) => t.id !== id);
      if (activeId === id) setActiveId(next[idx]?.id ?? next[idx - 1]?.id ?? null);
      return next;
    });
  }

  function expandDatabase(connId: string, database: string) {
    setActiveTarget({ connId, db: database });
    void poolsRef.current.get(connId)?.open(database);
  }

  useShortcuts({ palette: () => setPaletteOpen(true), newQuery: () => openQuery() });

  // --- derived ----------------------------------------------------------
  const sessionList = Object.values(sessions);
  const multiServer = sessionList.length > 1;

  const dbNamesFor = (connId: string, always?: string): string[] => {
    const sess = sessions[connId];
    const names = sess ? [...sess.databases] : [];
    for (const n of Object.keys(sess?.entries ?? {})) if (!names.includes(n)) names.push(n);
    if (always && !names.includes(always)) names.unshift(always);
    return names;
  };

  const servers: ServerNodeInfo[] = sessionList.map((sess) => ({
    connId: sess.conn.id,
    name: sess.conn.name,
    env: sess.conn.env,
    currentDatabase: sess.config.database,
    roles: sess.roles,
    databases: dbNamesFor(sess.conn.id).map((name): DbNodeInfo => {
      const e = sess.entries[name];
      if (!e) return { name, state: "closed" };
      if (e.state === "ready") return { name, state: "ready", catalog: e.catalog };
      if (e.state === "error") return { name, state: "error", error: e.error };
      return { name, state: "loading" };
    }),
  }));

  const readyEntry = (connId: string, database: string) => {
    const e = sessions[connId]?.entries[database];
    return e?.state === "ready" ? e : null;
  };
  const tableMeta = (t: Extract<WsTab, { kind: "table" }>) =>
    readyEntry(t.connId, t.db)
      ?.catalog.schemas.find((s) => s.name === t.schema)
      ?.tables.find((x) => x.name === t.table);

  const resolveFor = (connId: string) => async (database: string) => {
    const pool = poolsRef.current.get(connId);
    if (!pool) throw new Error("server disconnected");
    return pool.connectionId(database);
  };

  const paletteItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [];
    for (const sess of sessionList) {
      const prefix = multiServer ? `${sess.conn.name} · ` : "";
      for (const [name, entry] of Object.entries(sess.entries)) {
        if (entry.state !== "ready") continue;
        for (const s of entry.catalog.schemas)
          for (const t of s.tables)
            items.push({
              id: `t:${sess.conn.id}:${name}.${s.name}.${t.name}`,
              label: `${prefix}${name}.${s.name}.${t.name}`,
              type: "table",
              run: () => openTable(sess.conn.id, name, s.name, t.name),
            });
      }
    }
    items.push({ id: "cmd:newquery", label: "New Query", type: "command", run: () => openQuery() });
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  const tableCount = sessionList.reduce(
    (n, sess) =>
      n +
      Object.values(sess.entries).reduce(
        (m, e) => (e.state === "ready" ? m + e.catalog.schemas.reduce((k, s) => k + s.tables.length, 0) : m),
        0,
      ),
    0,
  );
  const activeSession = sessions[activeTarget.connId];

  return (
    <div className="gb-ws">
      <header className="titlebar" data-tauri-drag-region>
        <span className="brand"><BerryMark size={16} /> GreenBerry</span>
        <span className="sub">{activeSession?.conn.name ?? conn.name}</span>
        <span style={{ marginLeft: 6 }}>
          <EnvBadge env={activeSession?.conn.env ?? conn.env} />
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <Button size="sm" variant="ghost" onClick={() => openQuery()}>+ Query</Button>
          <Button size="sm" variant="ghost" onClick={() => setPaletteOpen(true)}>⌘K</Button>
          <Button size="sm" variant="ghost" onClick={toggleTheme}>{theme === "dark" ? "☾" : "☀"}</Button>
          <Button size="sm" variant="ghost" onClick={disconnectActive}>Disconnect</Button>
        </span>
      </header>

      <div className="gb-ws__body">
        {savedConnections.length > 0 &&
          (connPanelOpen ? (
            <aside className="gb-connpanel" aria-label="Connections panel">
              <div className="gb-connpanel__head">
                Connections
                <span className="gb-connect__count">{savedConnections.length}</span>
                <button
                  aria-label="collapse connections panel"
                  onClick={() => setConnPanelOpen(false)}
                >
                  ‹
                </button>
              </div>
              <div className="gb-connpanel__list">
                <SavedConnectionList
                  connections={savedConnections}
                  activeIds={Object.keys(sessions)}
                  disconnectingIds={Array.from(disconnecting)}
                  onConnect={(c) => void openServer(c)}
                  onEdit={setEditingConn}
                  onDelete={(c) => {
                    workspace.removeConnection(c.id);
                    notify(`Deleted “${c.name}”`, "info");
                  }}
                />
              </div>
            </aside>
          ) : (
            <div className="gb-connpanel is-collapsed">
              <button aria-label="expand connections panel" onClick={() => setConnPanelOpen(true)}>
                ›
              </button>
            </div>
          ))}
        <Sidebar
          servers={servers}
          onExpandDatabase={expandDatabase}
          onOpenTable={openTable}
          onCloseServer={disconnectServer}
        />
        <div className="gb-ws__main">
          {tabs.length > 0 && (
            <Tabs
              items={tabs.map((t) => ({ id: t.id, title: t.title }))}
              activeId={activeId ?? ""}
              onSelect={setActiveId}
              onClose={closeTab}
            />
          )}
          {/* S3.8: panes stay mounted so results/scroll/staged edits survive tab switches */}
          {tabs.map((t) => (
            <div
              key={t.id}
              className="gb-ws__pane"
              style={{ display: t.id === activeId ? "flex" : "none" }}
            >
              {t.kind === "table" ? (
                readyEntry(t.connId, t.db) ? (
                  <TableView
                    connectionId={readyEntry(t.connId, t.db)!.connectionId}
                    engine={sessions[t.connId]?.config.engine ?? "postgres"}
                    schema={t.schema}
                    table={t.table}
                    meta={tableMeta(t)}
                    onOpenQuery={(sql) => openQuery(sql, { connId: t.connId, db: t.db })}
                  />
                ) : (
                  <div style={{ padding: 16, color: "var(--dim)" }}>connecting…</div>
                )
              ) : (
                <QueryView
                  databases={dbNamesFor(t.connId, t.db)}
                  initialDatabase={t.db}
                  resolveConnection={resolveFor(t.connId)}
                  initialSql={t.sql}
                  onSqlChange={(sql) => updateQueryTab(t.id, { sql })}
                  onDatabaseChange={(database) => updateQueryTab(t.id, { db: database })}
                />
              )}
            </div>
          ))}
          {tabs.length === 0 && (
            <div className="gb-connect">
              <div className="gb-connect__card">
                <BrandLogo />
                <p style={{ color: "var(--dim)" }}>
                  Pick a table from the sidebar, press <b>⌘K</b>, or <b>+ Query</b>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="gb-ws__status">
        <span>● {activeSession?.conn.name ?? conn.name}</span>
        <span>{activeSession?.config.engine ?? config.engine}</span>
        <span>⛁ {activeTarget.db}</span>
        <span className="grow" />
        <span>{tableCount} tables</span>
        <span>⌘K palette · ⌘T new query</span>
      </div>

      {paletteOpen && (
        <>
          <div className="gb-palette__backdrop" onClick={() => setPaletteOpen(false)} />
          <Palette items={paletteItems} onClose={() => setPaletteOpen(false)} />
        </>
      )}

      {editingConn && (
        <ConnectionModal
          initial={editingConn}
          onSave={(stored, password) => {
            const full = password
              ? { ...stored, config: { ...stored.config, password } }
              : stored;
            workspace.addConnection(full);
            setEditingConn(null);
            notify(`Saved “${full.name}” — reconnect to apply`, "success");
          }}
          onClose={() => setEditingConn(null)}
        />
      )}
    </div>
  );
}
