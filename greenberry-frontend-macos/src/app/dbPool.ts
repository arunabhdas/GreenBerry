// Lazy per-database connection pool for the pgAdmin-style tree. Postgres
// binds one connection per database, so browsing a second database means
// opening a second connection; entries stay open until disconnectAll().
import type { Catalog } from "../lib/db";

export type DbEntry =
  | { state: "loading" }
  | { state: "ready"; connectionId: string; catalog: Catalog }
  | { state: "error"; error: string };

export interface DbPoolDeps {
  connect: (database: string) => Promise<string>;
  introspect: (connectionId: string) => Promise<Catalog>;
  disconnect: (connectionId: string) => Promise<void>;
}

function msg(e: unknown): string {
  return e && typeof e === "object" && "message" in e
    ? String((e as { message: unknown }).message)
    : String(e);
}

export class DbPool {
  private entries = new Map<string, DbEntry>();
  private inflight = new Map<string, Promise<DbEntry>>();
  /** Called with a fresh snapshot after every state change. */
  onChange: (snapshot: Record<string, DbEntry>) => void = () => {};

  constructor(private deps: DbPoolDeps) {}

  snapshot(): Record<string, DbEntry> {
    return Object.fromEntries(this.entries);
  }

  get(database: string): DbEntry | undefined {
    return this.entries.get(database);
  }

  /** Register an already-open connection (the one made at connect time). */
  seed(database: string, connectionId: string, catalog: Catalog): void {
    this.entries.set(database, { state: "ready", connectionId, catalog });
    this.emit();
  }

  /**
   * Open (or reuse) the connection for a database. Concurrent calls for the
   * same database share one attempt; a failed attempt is retried on the next
   * call rather than cached forever.
   */
  async open(database: string): Promise<DbEntry> {
    const existing = this.entries.get(database);
    if (existing?.state === "ready") return existing;
    const pending = this.inflight.get(database);
    if (pending) return pending;
    const attempt = this.doOpen(database);
    this.inflight.set(database, attempt);
    try {
      return await attempt;
    } finally {
      this.inflight.delete(database);
    }
  }

  /** Like open(), but throws on failure — for callers that need a connectionId. */
  async connectionId(database: string): Promise<string> {
    const entry = await this.open(database);
    if (entry.state !== "ready") {
      throw new Error(entry.state === "error" ? entry.error : "not connected");
    }
    return entry.connectionId;
  }

  /** Close every open connection and forget all entries. */
  async disconnectAll(): Promise<void> {
    const ids = [...this.entries.values()]
      .filter((e): e is Extract<DbEntry, { state: "ready" }> => e.state === "ready")
      .map((e) => e.connectionId);
    this.entries.clear();
    this.emit();
    await Promise.all(ids.map((id) => this.deps.disconnect(id).catch(() => {})));
  }

  private emit(): void {
    this.onChange(this.snapshot());
  }

  private async doOpen(database: string): Promise<DbEntry> {
    this.entries.set(database, { state: "loading" });
    this.emit();
    let entry: DbEntry;
    try {
      const connectionId = await this.deps.connect(database);
      const catalog = await this.deps.introspect(connectionId);
      entry = { state: "ready", connectionId, catalog };
    } catch (e) {
      entry = { state: "error", error: msg(e) };
    }
    this.entries.set(database, entry);
    this.emit();
    return entry;
  }
}
