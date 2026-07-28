import { describe, it, expect, vi } from "vitest";
import {
  WorkspaceStore,
  memoryPersistence,
  type Persistence,
  type StoredConnection,
  type WorkspaceState,
} from "./workspace";

const conn: StoredConnection = {
  id: "c1",
  name: "local pg",
  env: "local",
  config: {
    engine: "postgres",
    host: "localhost",
    port: 5432,
    user: "u",
    password: "s3cret",
    database: "d",
  },
};

/** In-memory Persistence that behaves like the SQLite app-db. */
function fakeAppDb(): Persistence & { dump(): Partial<WorkspaceState> } {
  const connections = new Map<string, StoredConnection>();
  const queries = new Map<string, { id: string; name: string; sql: string }>();
  const history: WorkspaceState["history"] = [];
  let settings: WorkspaceState["settings"] | undefined;
  return {
    load: async () => ({
      connections: [...connections.values()],
      savedQueries: [...queries.values()],
      history: [...history],
      ...(settings ? { settings } : {}),
    }),
    saveConnection: async (c) => void connections.set(c.id, c),
    deleteConnection: async (id) => void connections.delete(id),
    saveQuery: async (q) => void queries.set(q.id, q),
    addHistory: async (h) => void history.unshift(h),
    setSettings: async (s) => void (settings = s),
    dump: () => ({ connections: [...connections.values()] }),
  };
}

describe("WorkspaceStore (app-db backed)", () => {
  it("persists across a simulated restart, password included", async () => {
    const appdb = fakeAppDb();
    const a = new WorkspaceStore(appdb);
    a.addConnection(conn);
    a.updateSettings({ theme: "light", zoom: 1.2 });
    await Promise.resolve(); // let fire-and-forget persists land

    const b = new WorkspaceStore(appdb); // "restart"
    await b.hydrate();
    expect(b.getState().connections).toHaveLength(1);
    expect(b.getState().connections[0].name).toBe("local pg");
    // S10.3: the secret is part of the stored row, not a separate keychain
    expect(b.getState().connections[0].config.password).toBe("s3cret");
    expect(b.getState().settings.theme).toBe("light");
    expect(b.getState().settings.zoom).toBe(1.2);
  });

  it("addConnection upserts by id and removeConnection deletes durably", async () => {
    const appdb = fakeAppDb();
    const store = new WorkspaceStore(appdb);
    store.addConnection(conn);
    store.addConnection({ ...conn, name: "renamed" });
    expect(store.getState().connections).toHaveLength(1);
    expect(store.getState().connections[0].name).toBe("renamed");
    store.removeConnection("c1");
    await Promise.resolve();
    expect(store.getState().connections).toHaveLength(0);
    expect(appdb.dump().connections).toHaveLength(0);
  });

  it("history is newest-first and capped", () => {
    const store = new WorkspaceStore(memoryPersistence());
    for (let i = 0; i < 5; i++) {
      store.addHistory({ id: `h${i}`, sql: `select ${i}`, ts: i, status: "ok" });
    }
    expect(store.getState().history[0].id).toBe("h4");
    expect(store.getState().history).toHaveLength(5);
  });

  it("saveQuery upserts by id", () => {
    const store = new WorkspaceStore(memoryPersistence());
    store.saveQuery({ id: "q1", name: "A", sql: "select 1" });
    store.saveQuery({ id: "q1", name: "A2", sql: "select 2" });
    expect(store.getState().savedQueries).toHaveLength(1);
    expect(store.getState().savedQueries[0].name).toBe("A2");
  });

  it("notifies subscribers on change", () => {
    const store = new WorkspaceStore(memoryPersistence());
    let calls = 0;
    const unsub = store.subscribe(() => calls++);
    store.updateSettings({ zoom: 1.1 });
    expect(calls).toBe(1);
    unsub();
    store.updateSettings({ zoom: 1.2 });
    expect(calls).toBe(1);
  });

  it("keeps defaults when the app-db is unavailable", async () => {
    const broken: Persistence = {
      ...memoryPersistence(),
      load: vi.fn().mockRejectedValue(new Error("no app-db")),
    };
    const store = new WorkspaceStore(broken);
    await store.hydrate();
    expect(store.getState().connections).toEqual([]);
    expect(store.getState().settings.theme).toBe("dark");
  });
});
