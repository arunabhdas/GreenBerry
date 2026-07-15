// Async query runner (S3.4). Queries run per-tab and keep going regardless of
// which tab is active; results are never lost, and a finished-while-away flag
// drives the "green dot" until the tab is viewed.
import { db, type QueryResult } from "../../lib/db";

export type RunStatus = "idle" | "running" | "done" | "error";

export interface RunState {
  status: RunStatus;
  result?: QueryResult;
  error?: string;
  finishedUnseen: boolean; // green dot
}

type QueryApi = Pick<typeof db, "query">;

const IDLE: RunState = { status: "idle", finishedUnseen: false };

export class QueryRunner {
  private states = new Map<string, RunState>();
  private listeners = new Set<() => void>();

  constructor(private api: QueryApi = db) {}

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  private emit() {
    this.listeners.forEach((l) => l());
  }
  private set(tabId: string, s: RunState) {
    this.states.set(tabId, s);
    this.emit();
  }

  getState = (tabId: string): RunState => this.states.get(tabId) ?? IDLE;

  /** Clear the green dot once the user views the tab. */
  markSeen(tabId: string) {
    const s = this.states.get(tabId);
    if (s?.finishedUnseen) this.set(tabId, { ...s, finishedUnseen: false });
  }

  async run(tabId: string, connectionId: string, sql: string): Promise<void> {
    this.set(tabId, { status: "running", finishedUnseen: false });
    try {
      const result = await this.api.query(connectionId, sql);
      this.set(tabId, { status: "done", result, finishedUnseen: true });
    } catch (e) {
      const error =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : String(e);
      this.set(tabId, { status: "error", error, finishedUnseen: true });
    }
  }
}

export const runner = new QueryRunner();
