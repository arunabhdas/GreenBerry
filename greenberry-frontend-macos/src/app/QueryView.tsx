import { useEffect, useRef, useState } from "react";
import { db, type QueryResult } from "../lib/db";
import { SqlEditor } from "../features/editor/SqlEditor";
import { DataGrid } from "../features/grid/DataGrid";
import { useToast } from "../ui/Toast";
import { workspace } from "../lib/workspace";

function msg(e: unknown): string {
  return e && typeof e === "object" && "message" in e
    ? String((e as { message: unknown }).message)
    : String(e);
}

export function QueryView({
  databases,
  initialDatabase,
  resolveConnection,
  initialSql,
}: {
  /** Every database on the server, for the per-tab target dropdown. */
  databases: string[];
  /** The database this tab starts against (last browsed at creation). */
  initialDatabase: string;
  /** Lazily open/reuse the connection for a database; throws on failure. */
  resolveConnection: (database: string) => Promise<string>;
  initialSql?: string;
}) {
  const { notify } = useToast();
  const [sql, setSql] = useState(initialSql ?? "SELECT 1;");
  const [database, setDatabase] = useState(initialDatabase);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [running, setRunning] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(300);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    setH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  async function run(text: string) {
    setRunning(true);
    try {
      const connectionId = await resolveConnection(database);
      const res = await db.query(connectionId, text, { limit: 1000 });
      setResult(res);
      workspace.addHistory({
        id: `h${Date.now()}`,
        sql: text,
        ts: Date.now(),
        status: "ok",
        durationMs: res.elapsedMs,
      });
      notify(
        res.columns.length
          ? `${res.rowCount} rows${res.truncated ? "+" : ""} · ${res.elapsedMs.toFixed(0)}ms`
          : `${res.rowsAffected} row(s) affected · ${res.elapsedMs.toFixed(0)}ms`,
        "success",
      );
    } catch (e) {
      workspace.addHistory({ id: `h${Date.now()}`, sql: text, ts: Date.now(), status: "error" });
      notify(msg(e), "error");
    } finally {
      setRunning(false);
    }
  }

  const targets = databases.includes(database) ? databases : [database, ...databases];

  return (
    <div className="gb-ws__content">
      <div className="gb-toolbar gb-toolbar--query">
        <span className="gb-toolbar__dblabel">on</span>
        <select
          aria-label="query database"
          value={database}
          onChange={(e) => setDatabase(e.target.value)}
        >
          {targets.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <SqlEditor value={sql} onChange={setSql} onRun={run} running={running} />
      <div
        ref={wrapRef}
        style={{ flex: 1, minHeight: 0, borderTop: "1px solid var(--border)" }}
      >
        {result ? (
          result.columns.length ? (
            <DataGrid columns={result.columns} rows={result.rows} height={Math.max(120, h - 4)} />
          ) : (
            <div style={{ padding: 12, color: "var(--dim)" }}>
              {result.rowsAffected} row(s) affected.
            </div>
          )
        ) : (
          <div style={{ padding: 12, color: "var(--dim)" }}>
            Run a query (⌘↵) to see results.
          </div>
        )}
      </div>
    </div>
  );
}
