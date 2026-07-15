import { useMemo, useRef, useState } from "react";
import type { Catalog, ConnectionConfig } from "../lib/db";
import { db } from "../lib/db";
import type { StoredConnection } from "../lib/workspace";
import { Sidebar, type DbNodeInfo } from "../features/nav/Sidebar";
import { Tabs } from "../ui/Tabs";
import { Palette, type PaletteItem } from "../features/nav/Palette";
import { EnvBadge } from "../features/connections/env";
import { useShortcuts } from "../lib/shortcuts";
import { useTheme } from "../ui/theme";
import { Button } from "../ui/Button";
import { TableView } from "./TableView";
import { QueryView } from "./QueryView";
import { DbPool, type DbEntry } from "./dbPool";

type WsTab =
  | { id: string; kind: "table"; title: string; db: string; schema: string; table: string }
  | { id: string; kind: "query"; title: string; db: string; sql?: string };

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
  /** Every database on the server (like `\list`). */
  databases: string[];
  /** Server roles (like `\du`). */
  roles: string[];
  onDisconnect: () => void;
}) {
  const engine = config.engine;
  const { theme, toggleTheme } = useTheme();
  const [tabs, setTabs] = useState<WsTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // last-browsed database: new query tabs default to it
  const [activeDb, setActiveDb] = useState(config.database);

  const poolRef = useRef<DbPool | null>(null);
  if (!poolRef.current) {
    poolRef.current = new DbPool({
      connect: (database) => db.connect({ ...config, database }),
      introspect: (connectionId) => db.introspect(connectionId),
      disconnect: (connectionId) => db.disconnect(connectionId),
    });
    poolRef.current.seed(config.database, initialConnectionId, initialCatalog);
  }
  const pool = poolRef.current;
  const [dbEntries, setDbEntries] = useState<Record<string, DbEntry>>(() => pool.snapshot());
  pool.onChange = setDbEntries;

  // union: server list plus anything already open (covers a db missing from \list)
  const allDbNames = useMemo(() => {
    const names = [...databases];
    for (const name of Object.keys(dbEntries)) if (!names.includes(name)) names.push(name);
    return names;
  }, [databases, dbEntries]);

  const dbNodes: DbNodeInfo[] = allDbNames.map((name) => {
    const e = dbEntries[name];
    if (!e) return { name, state: "closed" };
    if (e.state === "ready") return { name, state: "ready", catalog: e.catalog };
    if (e.state === "error") return { name, state: "error", error: e.error };
    return { name, state: "loading" };
  });

  function expandDatabase(database: string) {
    setActiveDb(database);
    void pool.open(database);
  }

  function openTable(database: string, schema: string, table: string) {
    const id = `t:${database}.${schema}.${table}`;
    setTabs((ts) =>
      ts.some((t) => t.id === id)
        ? ts
        : [...ts, { id, kind: "table", title: table, db: database, schema, table }],
    );
    setActiveId(id);
    setActiveDb(database);
  }
  function openQuery(sql?: string, database?: string) {
    const id = `q:${Date.now()}`;
    setTabs((ts) => [...ts, { id, kind: "query", title: "Query", db: database ?? activeDb, sql }]);
    setActiveId(id);
  }
  function closeTab(id: string) {
    setTabs((ts) => {
      const idx = ts.findIndex((t) => t.id === id);
      const next = ts.filter((t) => t.id !== id);
      if (activeId === id) setActiveId(next[idx]?.id ?? next[idx - 1]?.id ?? null);
      return next;
    });
  }
  function disconnectAll() {
    void pool.disconnectAll();
    onDisconnect();
  }

  useShortcuts({ palette: () => setPaletteOpen(true), newQuery: () => openQuery() });

  const paletteItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [];
    for (const [name, entry] of Object.entries(dbEntries)) {
      if (entry.state !== "ready") continue;
      for (const s of entry.catalog.schemas)
        for (const t of s.tables)
          items.push({
            id: `t:${name}.${s.name}.${t.name}`,
            label: `${name}.${s.name}.${t.name}`,
            type: "table",
            run: () => openTable(name, s.name, t.name),
          });
    }
    items.push({ id: "cmd:newquery", label: "New Query", type: "command", run: () => openQuery() });
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbEntries]);

  const active = tabs.find((t) => t.id === activeId) ?? null;
  const readyEntry = (database: string) => {
    const e = dbEntries[database];
    return e?.state === "ready" ? e : null;
  };
  const tableMeta = (database: string, schema: string, table: string) =>
    readyEntry(database)
      ?.catalog.schemas.find((s) => s.name === schema)
      ?.tables.find((t) => t.name === table);
  const tableCount = Object.values(dbEntries).reduce(
    (n, e) => (e.state === "ready" ? n + e.catalog.schemas.reduce((m, s) => m + s.tables.length, 0) : n),
    0,
  );

  return (
    <div className="gb-ws">
      <header className="titlebar" data-tauri-drag-region>
        <span className="brand">🫐 GreenBerry</span>
        <span className="sub">{conn.name}</span>
        <span style={{ marginLeft: 6 }}>
          <EnvBadge env={conn.env} />
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <Button size="sm" variant="ghost" onClick={() => openQuery()}>+ Query</Button>
          <Button size="sm" variant="ghost" onClick={() => setPaletteOpen(true)}>⌘K</Button>
          <Button size="sm" variant="ghost" onClick={toggleTheme}>{theme === "dark" ? "☾" : "☀"}</Button>
          <Button size="sm" variant="ghost" onClick={disconnectAll}>Disconnect</Button>
        </span>
      </header>

      <div className="gb-ws__body">
        <Sidebar
          databases={dbNodes}
          currentDatabase={config.database}
          onExpandDatabase={expandDatabase}
          onOpenTable={openTable}
          roles={roles}
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
          {active ? (
            active.kind === "table" ? (
              readyEntry(active.db) ? (
                <TableView
                  key={active.id}
                  connectionId={readyEntry(active.db)!.connectionId}
                  engine={engine}
                  schema={active.schema}
                  table={active.table}
                  meta={tableMeta(active.db, active.schema, active.table)}
                  onOpenQuery={(sql) => openQuery(sql, active.db)}
                />
              ) : (
                <div style={{ padding: 16, color: "var(--dim)" }}>connecting…</div>
              )
            ) : (
              <QueryView
                key={active.id}
                databases={allDbNames}
                initialDatabase={active.db}
                resolveConnection={(database) => pool.connectionId(database)}
                initialSql={active.sql}
              />
            )
          ) : (
            <div className="gb-connect">
              <div className="gb-connect__card">
                <div className="mark">GreenBerry</div>
                <p style={{ color: "var(--dim)" }}>
                  Pick a table from the sidebar, press <b>⌘K</b>, or <b>+ Query</b>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="gb-ws__status">
        <span>● {conn.name}</span>
        <span>{engine}</span>
        <span>⛁ {activeDb}</span>
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
    </div>
  );
}
