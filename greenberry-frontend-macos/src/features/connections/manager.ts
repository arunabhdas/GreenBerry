// Connection manager (S2.5). Tracks multiple live connections + their status,
// independent of each other (connecting one never drops the others).
import { db } from "../../lib/db";
import type { StoredConnection } from "../../lib/workspace";

export type ConnStatus = "disconnected" | "connecting" | "connected" | "error";

export interface LiveConn {
  id: string; // stored connection id
  connectionId?: string; // handle from db.connect
  status: ConnStatus;
  error?: string;
}

type DbApi = Pick<typeof db, "connect" | "disconnect">;

export class ConnectionManager {
  private live = new Map<string, LiveConn>();
  private listeners = new Set<() => void>();

  constructor(private api: DbApi = db) {}

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  private emit() {
    this.listeners.forEach((l) => l());
  }

  getStatus = (storedId: string): ConnStatus =>
    this.live.get(storedId)?.status ?? "disconnected";

  handle = (storedId: string): string | undefined =>
    this.live.get(storedId)?.connectionId;

  list = (): LiveConn[] => [...this.live.values()];

  async connect(stored: StoredConnection): Promise<string> {
    this.live.set(stored.id, { id: stored.id, status: "connecting" });
    this.emit();
    try {
      const connectionId = await this.api.connect(stored.config);
      this.live.set(stored.id, {
        id: stored.id,
        connectionId,
        status: "connected",
      });
      this.emit();
      return connectionId;
    } catch (e) {
      const error =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : String(e);
      this.live.set(stored.id, { id: stored.id, status: "error", error });
      this.emit();
      throw e;
    }
  }

  async disconnect(storedId: string): Promise<void> {
    const h = this.handle(storedId);
    if (h) await this.api.disconnect(h);
    this.live.set(storedId, { id: storedId, status: "disconnected" });
    this.emit();
  }
}

export const connections = new ConnectionManager();
