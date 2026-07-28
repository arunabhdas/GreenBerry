import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db, type ColumnInfo, type Engine, type TableMeta } from "../lib/db";
import { buildSelect } from "../features/grid/sqlBuilder";
import { StagedChanges } from "../features/grid/staged";
import { DataGrid } from "../features/grid/DataGrid";
import { toCsv } from "../features/grid/exportData";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";

const PAGE = 200;

function msg(e: unknown): string {
  return e && typeof e === "object" && "message" in e
    ? String((e as { message: unknown }).message)
    : String(e);
}

function useHeight() {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(400);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    setH(el.clientHeight);
    return () => ro.disconnect();
  }, []);
  return [ref, h] as const;
}

export function TableView({
  connectionId,
  engine,
  schema,
  table,
  meta,
  onOpenQuery,
}: {
  connectionId: string;
  engine: Engine;
  schema: string;
  table: string;
  meta?: TableMeta;
  onOpenQuery: (sql: string) => void;
}) {
  const { notify } = useToast();
  const [cols, setCols] = useState<ColumnInfo[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [offset, setOffset] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<{ r: number; c: number; value: string } | null>(null);
  const staged = useRef(new StagedChanges(engine, { schema, name: table }, []));
  const [dirty, setDirty] = useState(0);
  const [gridRef, gridH] = useHeight();

  const pkCols = useMemo(
    () => (meta?.columns ?? []).filter((c) => c.primaryKey).map((c) => c.name),
    [meta],
  );

  const load = useCallback(
    async (off: number) => {
      setLoading(true);
      try {
        const sql = buildSelect(engine, { schema, name: table }, [], [], { limit: PAGE, offset: off });
        const res = await db.query(connectionId, sql, { limit: PAGE });
        setCols(res.columns);
        setRows(res.rows);
        setTruncated(res.truncated);
        setOffset(off);
      } catch (e) {
        notify(msg(e), "error");
      } finally {
        setLoading(false);
      }
    },
    [connectionId, engine, schema, table, notify],
  );

  useEffect(() => {
    staged.current = new StagedChanges(engine, { schema, name: table }, pkCols);
    setDirty(0);
    setEditing(null);
    void load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, schema, table]);

  const colIndex = (name: string) => cols.findIndex((c) => c.name === name);
  function pkOf(r: number): Record<string, unknown> | null {
    if (!pkCols.length) return null;
    const pk: Record<string, unknown> = {};
    for (const p of pkCols) {
      const i = colIndex(p);
      if (i < 0) return null;
      pk[p] = rows[r][i];
    }
    return pk;
  }

  function beginEdit(r: number, c: number) {
    if (!pkCols.length) {
      notify("Table has no primary key — read-only", "info");
      return;
    }
    const v = rows[r][c];
    setEditing({ r, c, value: v == null ? "" : String(v) });
  }

  function saveEdit(setNull = false) {
    if (!editing) return;
    const { r, c } = editing;
    const value = setNull ? null : editing.value;
    const pk = pkOf(r);
    if (pk) {
      staged.current.editCell(pk, cols[c].name, value);
      setRows((rs) => rs.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? value : cell)) : row)));
      setDirty(staged.current.count());
    }
    setEditing(null);
  }

  async function commitAll() {
    const sql = staged.current.previewSql();
    if (!sql.length) return;
    try {
      const affected = await db.execBatch(connectionId, sql);
      notify(`Committed ${sql.length} statement(s) · ${affected} row(s)`, "success");
      staged.current.clear();
      setDirty(0);
      void load(offset);
    } catch (e) {
      notify(msg(e), "error");
    }
  }

  function exportCsv() {
    const csv = toCsv(cols.map((c) => c.name), rows);
    navigator.clipboard?.writeText(csv).catch(() => {});
    notify(`CSV of ${rows.length} rows copied to clipboard`, "success");
  }

  const genSql = () => buildSelect(engine, { schema, name: table }, [], [], { limit: PAGE, offset: 0 });

  return (
    <div className="gb-ws__content">
      <div className="gb-toolbar">
        <span className="gb-toolbar__title">
          {schema}.{table}
        </span>
        <Button size="sm" onClick={() => load(offset)}>↻ Refresh</Button>
        <Button size="sm" onClick={() => onOpenQuery(genSql())}>Open as SQL</Button>
        <Button size="sm" variant="ghost" onClick={exportCsv}>Export CSV</Button>
        <span className="grow" />
        <Button size="sm" variant="ghost" disabled={offset === 0} onClick={() => load(Math.max(0, offset - PAGE))}>
          ‹ Prev
        </Button>
        <span style={{ color: "var(--dim)" }}>
          rows {rows.length ? offset + 1 : 0}–{offset + rows.length}
          {truncated ? "+" : ""}
        </span>
        <Button size="sm" variant="ghost" disabled={!truncated} onClick={() => load(offset + PAGE)}>
          Next ›
        </Button>
      </div>

      <div ref={gridRef} style={{ flex: 1, minHeight: 0 }}>
        {loading ? (
          <div style={{ padding: 16, color: "var(--dim)" }}>loading…</div>
        ) : (
          <DataGrid columns={cols} rows={rows} height={Math.max(120, gridH - 30)} onCellClick={beginEdit} />
        )}
      </div>

      {editing && (
        <div className="gb-commitbar" style={{ background: "var(--panel)" }}>
          <span style={{ fontFamily: "var(--font-mono)" }}>
            {cols[editing.c]?.name} =
          </span>
          <input
            autoFocus
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={editing.value}
            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") setEditing(null);
            }}
            style={{ flex: 1 }}
          />
          <Button size="sm" variant="ghost" onClick={() => saveEdit(true)}>Set NULL</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button size="sm" variant="primary" onClick={() => saveEdit()}>Stage</Button>
        </div>
      )}

      {dirty > 0 && (
        <div className="gb-commitbar">
          <span>● {dirty} pending change(s)</span>
          <span className="grow" />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => notify(staged.current.previewSql().join("\n"), "info", 9000)}
          >
            Preview SQL
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { staged.current.clear(); setDirty(0); void load(offset); }}>
            Discard
          </Button>
          <Button size="sm" variant="primary" onClick={commitAll}>Commit</Button>
        </div>
      )}
    </div>
  );
}
