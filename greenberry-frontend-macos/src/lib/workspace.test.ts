import { describe, it, expect } from "vitest";
import { WorkspaceStore, type StorageLike } from "./workspace";

function memStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v);
    },
  };
}

describe("WorkspaceStore", () => {
  it("persists across a simulated restart", () => {
    const storage = memStorage();
    const a = new WorkspaceStore(storage);
    a.addConnection({
      id: "c1",
      name: "local pg",
      env: "local",
      config: {
        engine: "postgres",
        host: "localhost",
        port: 5432,
        user: "u",
        database: "d",
      },
    });
    a.updateSettings({ theme: "light", zoom: 1.2 });

    const b = new WorkspaceStore(storage); // "restart"
    expect(b.getState().connections).toHaveLength(1);
    expect(b.getState().connections[0].name).toBe("local pg");
    expect(b.getState().settings.theme).toBe("light");
    expect(b.getState().settings.zoom).toBe(1.2);
  });

  it("history is newest-first and capped", () => {
    const store = new WorkspaceStore(memStorage());
    for (let i = 0; i < 5; i++) {
      store.addHistory({ id: `h${i}`, sql: `select ${i}`, ts: i, status: "ok" });
    }
    expect(store.getState().history[0].id).toBe("h4");
    expect(store.getState().history).toHaveLength(5);
  });

  it("saveQuery upserts by id", () => {
    const store = new WorkspaceStore(memStorage());
    store.saveQuery({ id: "q1", name: "A", sql: "select 1" });
    store.saveQuery({ id: "q1", name: "A2", sql: "select 2" });
    expect(store.getState().savedQueries).toHaveLength(1);
    expect(store.getState().savedQueries[0].name).toBe("A2");
  });

  it("notifies subscribers on change", () => {
    const store = new WorkspaceStore(memStorage());
    let calls = 0;
    const unsub = store.subscribe(() => calls++);
    store.updateSettings({ zoom: 1.1 });
    expect(calls).toBe(1);
    unsub();
    store.updateSettings({ zoom: 1.2 });
    expect(calls).toBe(1);
  });

  it("falls back to defaults on corrupt storage", () => {
    const storage = memStorage();
    storage.setItem("greenberry.workspace.v1", "{not json");
    const store = new WorkspaceStore(storage);
    expect(store.getState().connections).toEqual([]);
    expect(store.getState().settings.theme).toBe("dark");
  });
});
