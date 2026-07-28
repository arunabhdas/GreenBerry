import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { db, newToken } from "./db";

const mockInvoke = vi.mocked(invoke);

describe("db client", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("connect forwards the config", async () => {
    mockInvoke.mockResolvedValue("conn-1");
    const id = await db.connect({
      engine: "postgres",
      host: "h",
      port: 5432,
      user: "u",
      database: "d",
    });
    expect(id).toBe("conn-1");
    expect(mockInvoke).toHaveBeenCalledWith("db_connect", {
      config: expect.objectContaining({ engine: "postgres", host: "h" }),
    });
  });

  it("query passes sql, limit and token", async () => {
    mockInvoke.mockResolvedValue({
      columns: [],
      rows: [],
      rowCount: 0,
      rowsAffected: 0,
      elapsedMs: 1,
      truncated: false,
    });
    await db.query("c1", "select 1", { limit: 50, token: "tk" });
    expect(mockInvoke).toHaveBeenCalledWith("db_query", {
      connectionId: "c1",
      sql: "select 1",
      limit: 50,
      token: "tk",
    });
  });

  it("query defaults limit to null and generates a token", async () => {
    mockInvoke.mockResolvedValue({
      columns: [],
      rows: [],
      rowCount: 0,
      rowsAffected: 0,
      elapsedMs: 0,
      truncated: false,
    });
    await db.query("c1", "select 1");
    const args = mockInvoke.mock.calls[0][1] as Record<string, unknown>;
    expect(args.limit).toBeNull();
    expect(typeof args.token).toBe("string");
    expect((args.token as string).length).toBeGreaterThan(0);
  });

  it("cancel and introspect map to their commands", async () => {
    mockInvoke.mockResolvedValue(true);
    await db.cancel("c1", "tk");
    expect(mockInvoke).toHaveBeenCalledWith("db_cancel", {
      connectionId: "c1",
      token: "tk",
    });

    mockInvoke.mockResolvedValue({ schemas: [] });
    await db.introspect("c1");
    expect(mockInvoke).toHaveBeenCalledWith("db_introspect", {
      connectionId: "c1",
    });
  });

  it("newToken produces unique values", () => {
    expect(newToken()).not.toBe(newToken());
  });
});
