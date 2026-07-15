import { describe, it, expect, vi } from "vitest";
import { ConnectionManager } from "./manager";
import type { StoredConnection } from "../../lib/workspace";

const stored = (id: string): StoredConnection => ({
  id,
  name: id,
  env: "local",
  config: { engine: "postgres", host: "h", port: 5432, user: "u", database: "d" },
});

describe("ConnectionManager", () => {
  it("connects and tracks the handle", async () => {
    const api = { connect: vi.fn().mockResolvedValue("h1"), disconnect: vi.fn() };
    const m = new ConnectionManager(api);
    const id = await m.connect(stored("a"));
    expect(id).toBe("h1");
    expect(m.getStatus("a")).toBe("connected");
    expect(m.handle("a")).toBe("h1");
  });

  it("records connection errors", async () => {
    const api = {
      connect: vi.fn().mockRejectedValue({ message: "nope" }),
      disconnect: vi.fn(),
    };
    const m = new ConnectionManager(api);
    await expect(m.connect(stored("a"))).rejects.toBeTruthy();
    expect(m.getStatus("a")).toBe("error");
    expect(m.list()[0].error).toBe("nope");
  });

  it("keeps multiple connections independent", async () => {
    const api = {
      connect: vi.fn().mockResolvedValueOnce("h1").mockResolvedValueOnce("h2"),
      disconnect: vi.fn(),
    };
    const m = new ConnectionManager(api);
    await m.connect(stored("a"));
    await m.connect(stored("b"));
    expect(m.getStatus("a")).toBe("connected");
    expect(m.getStatus("b")).toBe("connected");

    await m.disconnect("a");
    expect(m.getStatus("a")).toBe("disconnected");
    expect(m.getStatus("b")).toBe("connected"); // untouched
    expect(api.disconnect).toHaveBeenCalledWith("h1");
  });

  it("notifies subscribers", async () => {
    const api = { connect: vi.fn().mockResolvedValue("h1"), disconnect: vi.fn() };
    const m = new ConnectionManager(api);
    let calls = 0;
    m.subscribe(() => calls++);
    await m.connect(stored("a"));
    expect(calls).toBeGreaterThanOrEqual(2); // connecting + connected
  });
});
