// Workspace persistence (S1.5, reworked for S10.3): a small reactive store
// whose durable copy lives in the SQLite app-db (Rust `store_*` commands).
// localStorage is no longer used; passwords persist with the connection row
// (ADR 0002). Outside Tauri (unit tests, plain browser) persistence is an
// in-memory no-op and the store is purely reactive.
import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ConnectionConfig } from "./db";

export type EnvTag = "local" | "dev" | "staging" | "prod";

export interface StoredConnection {
  id: string;
  name: string;
  env: EnvTag;
  config: ConnectionConfig;
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  folder?: string;
}

export interface HistoryItem {
  id: string;
  sql: string;
  ts: number;
  status: "ok" | "error";
  durationMs?: number;
}

export interface Dashboard {
  id: string;
  name: string;
}

export interface Settings {
  theme: "dark" | "light";
  zoom: number;
  rowLimit: number;
  safeMode: "off" | "confirm" | "typed";
  shortcuts: Record<string, string>;
}

export interface WorkspaceState {
  version: number;
  connections: StoredConnection[];
  savedQueries: SavedQuery[];
  history: HistoryItem[];
  dashboards: Dashboard[];
  settings: Settings;
}

const HISTORY_CAP = 500;

export function defaultState(): WorkspaceState {
  return {
    version: 2, // v2: app-db backed (v1 was a localStorage blob)
    connections: [],
    savedQueries: [],
    history: [],
    dashboards: [],
    settings: {
      theme: "dark",
      zoom: 1,
      rowLimit: 1000,
      safeMode: "confirm",
      shortcuts: {},
    },
  };
}

/** Durable backend. The real one is the SQLite app-db over IPC. */
export interface Persistence {
  load(): Promise<Partial<WorkspaceState>>;
  saveConnection(c: StoredConnection): Promise<void>;
  deleteConnection(id: string): Promise<void>;
  saveQuery(q: SavedQuery): Promise<void>;
  addHistory(h: HistoryItem): Promise<void>;
  setSettings(s: Settings): Promise<void>;
}

export function appDbPersistence(): Persistence {
  return {
    async load() {
      const [connections, savedQueries, history, settingsRaw] = await Promise.all([
        invoke<StoredConnection[]>("store_list_connections"),
        invoke<SavedQuery[]>("store_list_queries"),
        invoke<HistoryItem[]>("store_list_history", { limit: HISTORY_CAP }),
        invoke<string | null>("store_get_kv", { key: "settings" }),
      ]);
      const out: Partial<WorkspaceState> = { connections, savedQueries, history };
      if (settingsRaw) {
        try {
          out.settings = JSON.parse(settingsRaw) as Settings;
        } catch {
          /* corrupt settings JSON — fall back to defaults */
        }
      }
      return out;
    },
    saveConnection: (c) => invoke("store_save_connection", { conn: c }),
    deleteConnection: (id) => invoke("store_delete_connection", { id }),
    saveQuery: (q) => invoke("store_save_query", { query: q }),
    addHistory: (h) => invoke("store_add_history", { item: h }),
    setSettings: (s) =>
      invoke("store_set_kv", { key: "settings", value: JSON.stringify(s) }),
  };
}

export function memoryPersistence(): Persistence {
  return {
    load: async () => ({}),
    saveConnection: async () => {},
    deleteConnection: async () => {},
    saveQuery: async () => {},
    addHistory: async () => {},
    setSettings: async () => {},
  };
}

export class WorkspaceStore {
  private state: WorkspaceState = defaultState();
  private listeners = new Set<() => void>();

  constructor(private persistence: Persistence) {}

  getState = (): WorkspaceState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private commit(next: WorkspaceState) {
    this.state = next;
    this.listeners.forEach((l) => l());
  }

  update(patch: (s: WorkspaceState) => WorkspaceState) {
    this.commit(patch(this.state));
  }

  /** Load the durable state from the app-db (call once at startup). */
  async hydrate(): Promise<void> {
    try {
      const loaded = await this.persistence.load();
      this.update((s) => ({
        ...s,
        ...loaded,
        settings: { ...s.settings, ...(loaded.settings ?? {}) },
      }));
    } catch {
      /* app-db unavailable (non-Tauri env) — keep defaults */
    }
  }

  addConnection(c: StoredConnection) {
    this.update((s) => ({
      ...s,
      connections: [...s.connections.filter((x) => x.id !== c.id), c],
    }));
    void this.persistence.saveConnection(c).catch(() => {});
  }

  removeConnection(id: string) {
    this.update((s) => ({
      ...s,
      connections: s.connections.filter((c) => c.id !== id),
    }));
    void this.persistence.deleteConnection(id).catch(() => {});
  }

  saveQuery(q: SavedQuery) {
    this.update((s) => ({
      ...s,
      savedQueries: [...s.savedQueries.filter((x) => x.id !== q.id), q],
    }));
    void this.persistence.saveQuery(q).catch(() => {});
  }

  addHistory(h: HistoryItem) {
    this.update((s) => ({ ...s, history: [h, ...s.history].slice(0, HISTORY_CAP) }));
    void this.persistence.addHistory(h).catch(() => {});
  }

  updateSettings(patch: Partial<Settings>) {
    this.update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
    void this.persistence.setSettings(this.state.settings).catch(() => {});
  }
}

const hasTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const workspace = new WorkspaceStore(
  hasTauri ? appDbPersistence() : memoryPersistence(),
);

/** React hook: select from the shared workspace store. */
export function useWorkspace<T>(selector: (s: WorkspaceState) => T): T {
  return useSyncExternalStore(workspace.subscribe, () =>
    selector(workspace.getState()),
  );
}
