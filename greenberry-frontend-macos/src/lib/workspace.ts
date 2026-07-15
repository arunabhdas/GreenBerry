// Workspace persistence (S1.5). A small reactive store persisted to a
// StorageLike backend (localStorage in the Tauri webview, in-memory in tests),
// so connections / saved queries / history / dashboards / settings survive a
// restart.
import { useSyncExternalStore } from "react";
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

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = "greenberry.workspace.v1";
const HISTORY_CAP = 500;

export function defaultState(): WorkspaceState {
  return {
    version: 1,
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

export function loadState(storage: StorageLike): WorkspaceState {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<WorkspaceState>;
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return defaultState();
  }
}

export class WorkspaceStore {
  private state: WorkspaceState;
  private listeners = new Set<() => void>();

  constructor(private storage: StorageLike) {
    this.state = loadState(storage);
  }

  getState = (): WorkspaceState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private commit(next: WorkspaceState) {
    this.state = next;
    try {
      this.storage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / unavailable storage */
    }
    this.listeners.forEach((l) => l());
  }

  update(patch: (s: WorkspaceState) => WorkspaceState) {
    this.commit(patch(this.state));
  }

  addConnection(c: StoredConnection) {
    this.update((s) => ({ ...s, connections: [...s.connections, c] }));
  }

  removeConnection(id: string) {
    this.update((s) => ({
      ...s,
      connections: s.connections.filter((c) => c.id !== id),
    }));
  }

  saveQuery(q: SavedQuery) {
    this.update((s) => ({
      ...s,
      savedQueries: [...s.savedQueries.filter((x) => x.id !== q.id), q],
    }));
  }

  addHistory(h: HistoryItem) {
    this.update((s) => ({ ...s, history: [h, ...s.history].slice(0, HISTORY_CAP) }));
  }

  updateSettings(patch: Partial<Settings>) {
    this.update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }
}

function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v);
    },
  };
}

export const workspace = new WorkspaceStore(
  typeof localStorage !== "undefined" ? localStorage : memoryStorage(),
);

/** React hook: select from the shared workspace store. */
export function useWorkspace<T>(selector: (s: WorkspaceState) => T): T {
  return useSyncExternalStore(workspace.subscribe, () =>
    selector(workspace.getState()),
  );
}
