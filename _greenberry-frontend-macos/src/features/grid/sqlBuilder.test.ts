import { describe, it, expect } from "vitest";
import { buildSelect, buildWhere, quoteIdent } from "./sqlBuilder";

describe("sqlBuilder", () => {
  it("quotes identifiers per engine", () => {
    expect(quoteIdent("postgres", "col")).toBe('"col"');
    expect(quoteIdent("mysql", "col")).toBe("`col`");
    expect(quoteIdent("mssql", "col")).toBe("[col]");
  });

  it("builds WHERE with ILIKE + escaping on postgres", () => {
    expect(buildWhere("postgres", [{ column: "name", op: "contains", value: "a'b" }])).toBe(
      ` WHERE "name" ILIKE '%a''b%'`,
    );
  });

  it("uses LIKE (not ILIKE) on mysql", () => {
    expect(buildWhere("mysql", [{ column: "n", op: "startsWith", value: "x" }])).toBe(
      " WHERE `n` LIKE 'x%'",
    );
  });

  it("handles isNull and IN", () => {
    expect(buildWhere("postgres", [{ column: "c", op: "isNull" }])).toBe(
      ` WHERE "c" IS NULL`,
    );
    expect(buildWhere("postgres", [{ column: "c", op: "in", value: "a, b" }])).toBe(
      ` WHERE "c" IN ('a', 'b')`,
    );
  });

  it("builds a full select (pg)", () => {
    const sql = buildSelect(
      "postgres",
      { schema: "public", name: "users" },
      [{ column: "active", op: "=", value: "true" }],
      [{ column: "id", dir: "desc" }],
      { limit: 100, offset: 200 },
    );
    expect(sql).toBe(
      `SELECT * FROM "public"."users" WHERE "active" = 'true' ORDER BY "id" DESC LIMIT 100 OFFSET 200`,
    );
  });

  it("uses OFFSET/FETCH pagination on mssql", () => {
    const sql = buildSelect("mssql", { name: "t" }, [], [{ column: "id", dir: "asc" }], {
      limit: 10,
      offset: 20,
    });
    expect(sql).toContain("OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY");
  });
});
