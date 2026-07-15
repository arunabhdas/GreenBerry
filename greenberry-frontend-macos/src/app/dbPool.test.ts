import { describe, it, expect, vi } from "vitest";
import { DbPool } from "./dbPool";
import type { Catalog } from "../lib/db";

const catalog: Catalog = { schemas: [{ name: "public", tables: [] }] };

function makePool(overrides: Partial<ConstructorParameters<typeof DbPool>[0]> = {}) {
  const deps = {
    connect: vi.fn(async (db: string) => `cid-${db}`),
    introspect: vi.fn(async () => catalog),
    disconnect: vi.fn(async () => {}),
    ...overrides,
  };
  return { pool: new DbPool(deps), deps };
}

describe("DbPool", () => {
  it("opens lazily and caches the ready entry", async () => {
    const { pool, deps } = makePool();
    const a = await pool.open("app");
    const b = await pool.open("app");
    expect(a.state).toBe("ready");
    expect(b).toBe(a);
    expect(deps.connect).toHaveBeenCalledTimes(1);
    expect(deps.introspect).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent opens of the same database", async () => {
    const { pool, deps } = makePool();
    const [a, b] = await Promise.all([pool.open("app"), pool.open("app")]);
    expect(a).toBe(b);
    expect(deps.connect).toHaveBeenCalledTimes(1);
  });

  it("records errors and retries on the next open", async () => {
    const connect = vi
      .fn()
      .mockRejectedValueOnce(new Error("no CONNECT privilege"))
      .mockResolvedValue("cid-app");
    const { pool, deps } = makePool({ connect });
    const first = await pool.open("app");
    expect(first).toEqual({ state: "error", error: "no CONNECT privilege" });
    const second = await pool.open("app");
    expect(second.state).toBe("ready");
    expect(deps.connect).toHaveBeenCalledTimes(2);
  });

  it("seed registers an existing connection without connecting", async () => {
    const { pool, deps } = makePool();
    pool.seed("postgres", "cid-0", catalog);
    const entry = await pool.open("postgres");
    expect(entry).toEqual({ state: "ready", connectionId: "cid-0", catalog });
    expect(deps.connect).not.toHaveBeenCalled();
  });

  it("connectionId returns the id or throws the recorded error", async () => {
    const connect = vi.fn().mockRejectedValue(new Error("nope"));
    const { pool } = makePool({ connect });
    await expect(pool.connectionId("bad")).rejects.toThrow("nope");
    pool.seed("ok", "cid-ok", catalog);
    await expect(pool.connectionId("ok")).resolves.toBe("cid-ok");
  });

  it("notifies onChange with snapshots as entries change", async () => {
    const { pool } = makePool();
    const states: string[] = [];
    pool.onChange = (snap) => states.push(snap["app"]?.state ?? "gone");
    await pool.open("app");
    expect(states).toEqual(["loading", "ready"]);
  });

  it("disconnectAll closes every ready connection and clears entries", async () => {
    const { pool, deps } = makePool();
    pool.seed("a", "cid-a", catalog);
    await pool.open("b");
    await pool.disconnectAll();
    expect(deps.disconnect).toHaveBeenCalledWith("cid-a");
    expect(deps.disconnect).toHaveBeenCalledWith("cid-b");
    expect(pool.snapshot()).toEqual({});
  });
});
