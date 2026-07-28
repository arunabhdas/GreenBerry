import { useState } from "react";
import type { Catalog } from "../../lib/db";
import type { EnvTag } from "../../lib/workspace";
import { EnvBadge } from "../connections/env";
import { buildTree, filterTree, type TreeNode } from "./tree";

/** One database under a server (pgAdmin-style). */
export interface DbNodeInfo {
  name: string;
  /** closed = not yet connected; expanding a closed/error node connects lazily. */
  state: "closed" | "loading" | "ready" | "error";
  catalog?: Catalog;
  error?: string;
}

/** One connected server: a root group in the tree (S3.8 multi-server). */
export interface ServerNodeInfo {
  connId: string;
  name: string;
  env: EnvTag;
  databases: DbNodeInfo[];
  roles?: string[];
  /** Database to auto-expand (the one connected at login). */
  currentDatabase?: string;
}

export interface SidebarProps {
  servers: ServerNodeInfo[];
  onExpandDatabase?: (connId: string, database: string) => void;
  onOpenTable?: (connId: string, database: string, schema: string, table: string) => void;
  /** Close one server without touching the others (hidden for a lone server). */
  onCloseServer?: (connId: string) => void;
}

export function Sidebar({ servers, onExpandDatabase, onOpenTable, onCloseServer }: SidebarProps) {
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="gb-sidebar is-collapsed">
        <button aria-label="expand sidebar" onClick={() => setCollapsed(false)}>
          ›
        </button>
      </div>
    );
  }

  return (
    <aside className="gb-sidebar" aria-label="Schema">
      <div className="gb-sidebar__head">
        <input
          aria-label="filter tables"
          placeholder="Search tables"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button aria-label="collapse sidebar" onClick={() => setCollapsed(true)}>
          ‹
        </button>
      </div>
      <div className="gb-sidebar__tree" role="tree">
        {servers.map((server) => (
          <ServerNode
            key={server.connId}
            server={server}
            filter={filter}
            canClose={servers.length > 1 && !!onCloseServer}
            onClose={onCloseServer}
            onExpandDatabase={onExpandDatabase}
            onOpenTable={onOpenTable}
          />
        ))}
      </div>
    </aside>
  );
}

function ServerNode({
  server,
  filter,
  canClose,
  onClose,
  onExpandDatabase,
  onOpenTable,
}: {
  server: ServerNodeInfo;
  filter: string;
  canClose: boolean;
  onClose?: (connId: string) => void;
  onExpandDatabase?: (connId: string, database: string) => void;
  onOpenTable?: (connId: string, database: string, schema: string, table: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const q = filter.trim().toLowerCase();

  const visible = server.databases.filter((d) => {
    if (!q) return true;
    if (d.name.toLowerCase().includes(q)) return true;
    return d.catalog ? filterTree(buildTree(d.catalog), filter).length > 0 : false;
  });
  if (q && visible.length === 0 && !server.name.toLowerCase().includes(q)) return null;

  return (
    <div role="treeitem" aria-expanded={open} className="gb-tree__servergroup">
      <div className="gb-tree__serverrow">
        <button className="gb-tree__row gb-tree__server" onClick={() => setOpen((o) => !o)}>
          {open ? "▾" : "▸"} ⛃ {server.name} <EnvBadge env={server.env} />
        </button>
        {canClose && (
          <button
            className="gb-tree__serverclose"
            aria-label={`close server ${server.name}`}
            title="Close server"
            onClick={() => onClose?.(server.connId)}
          >
            ✕
          </button>
        )}
      </div>
      {open && (
        <div className="gb-tree__nest">
          {visible.map((db) => (
            <DatabaseNode
              key={db.name}
              db={db}
              filter={filter}
              defaultOpen={db.name === server.currentDatabase}
              onExpand={(name) => onExpandDatabase?.(server.connId, name)}
              onOpenTable={(name, schema, table) =>
                onOpenTable?.(server.connId, name, schema, table)
              }
            />
          ))}
          {server.roles && server.roles.length > 0 && !q && <RolesNode roles={server.roles} />}
        </div>
      )}
    </div>
  );
}

function DatabaseNode({
  db,
  filter,
  defaultOpen,
  onExpand,
  onOpenTable,
}: {
  db: DbNodeInfo;
  filter: string;
  defaultOpen: boolean;
  onExpand?: (database: string) => void;
  onOpenTable?: (database: string, schema: string, table: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && (db.state === "closed" || db.state === "error")) onExpand?.(db.name);
  }

  const tree = db.catalog ? filterTree(buildTree(db.catalog), filter) : [];

  return (
    <div role="treeitem" aria-expanded={open}>
      <button className="gb-tree__row gb-tree__db" onClick={toggle}>
        {open ? "▾" : "▸"} ⛁ {db.name}
      </button>
      {open && db.state === "loading" && (
        <div className="gb-tree__col">connecting…</div>
      )}
      {open && db.state === "error" && (
        <button
          className="gb-tree__col gb-tree__error"
          onClick={() => onExpand?.(db.name)}
        >
          ⚠ {db.error ?? "failed"} — retry
        </button>
      )}
      {open &&
        db.state === "ready" &&
        tree.map((schema) => (
          <SchemaNode
            key={schema.id}
            node={schema}
            onOpenTable={(s, t) => onOpenTable?.(db.name, s, t)}
          />
        ))}
    </div>
  );
}

function RolesNode({ roles }: { roles: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div role="treeitem" aria-expanded={open} aria-label="Roles">
      <button className="gb-tree__row gb-tree__db" onClick={() => setOpen((o) => !o)}>
        {open ? "▾" : "▸"} ⚇ Roles <span className="gb-tree__type">{roles.length}</span>
      </button>
      {open &&
        roles.map((r) => (
          <div key={r} className="gb-tree__col">
            {r}
          </div>
        ))}
    </div>
  );
}

function SchemaNode({
  node,
  onOpenTable,
}: {
  node: TreeNode;
  onOpenTable?: (schema: string, table: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div role="treeitem" aria-expanded={open} className="gb-tree__nest">
      <button className="gb-tree__row" onClick={() => setOpen((o) => !o)}>
        {open ? "▾" : "▸"} {node.label}
      </button>
      {open &&
        node.children?.map((table) => (
          <TableNode
            key={table.id}
            schema={node.label}
            node={table}
            onOpenTable={onOpenTable}
          />
        ))}
    </div>
  );
}

function TableNode({
  schema,
  node,
  onOpenTable,
}: {
  schema: string;
  node: TreeNode;
  onOpenTable?: (schema: string, table: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div role="treeitem" aria-expanded={open}>
      <div className="gb-tree__row">
        <button aria-label={`toggle ${node.label}`} onClick={() => setOpen((o) => !o)}>
          {open ? "▾" : "▸"}
        </button>
        <button
          className="gb-tree__table"
          onClick={() => onOpenTable?.(schema, node.label)}
        >
          {node.label}
        </button>
      </div>
      {open &&
        node.children?.map((col) => (
          <div key={col.id} className="gb-tree__col">
            {col.label} <span className="gb-tree__type">{col.sub}</span>
          </div>
        ))}
    </div>
  );
}
