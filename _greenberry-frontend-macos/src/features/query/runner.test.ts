import { describe, it, expect, vi } from "vitest";
import { QueryRunner } from "./runner";
import type { QueryResult } from "../../lib/db";

const ok: QueryResult = {
  columns: [],
  rows: [],
  rowCount: 0,
  rowsAffected: 0,
  elapsedMs: 1,
  truncated: false,
};

describe("QueryRunner", () => {
  it("runs, stores the result, and raises the green dot", async () => {
    const api = { query: vi.fn().mockResolvedValue(ok) };
    const r = new QueryRunner(api);
    await r.run("t1", "c1", "select 1");
    const s = r.getState("t1");
    expect(s.status).toBe("done");
    expect(s.result).toEqual(ok);
    expect(s.finishedUnseen).toBe(true);
    r.markSeen("t1");
    expect(r.getState("t1").finishedUnseen).toBe(false);
  });

  it("captures errors", async () => {
    const api = { query: vi.fn().mockRejectedValue({ message: "boom" }) };
    const r = new QueryRunner(api);
    await r.run("t1", "c1", "bad");
    expect(r.getState("t1").status).toBe("error");
    expect(r.getState("t1").error).toBe("boom");
  });

  it("keeps per-tab state independent (results never lost)", async () => {
    let resolve2!: (v: QueryResult) => void;
    const p2 = new Promise<QueryResult>((res) => {
      resolve2 = res;
    });
    const api = {
      query: vi.fn().mockResolvedValueOnce(ok).mockReturnValueOnce(p2),
    };
    const r = new QueryRunner(api);
    await r.run("t1", "c1", "select 1");
    const run2 = r.run("t2", "c1", "select 2");
    expect(r.getState("t2").status).toBe("running");
    expect(r.getState("t1").status).toBe("done"); // unaffected by t2
    resolve2(ok);
    await run2;
    expect(r.getState("t2").status).toBe("done");
  });
});
