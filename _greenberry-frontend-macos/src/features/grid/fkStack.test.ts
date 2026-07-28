import { describe, it, expect } from "vitest";
import { FkStack, buildFkQuery } from "./fkStack";

describe("FK follow (S4.8)", () => {
  it("builds a query to the referenced row", () => {
    const sql = buildFkQuery(
      "postgres",
      { schema: "public", table: "users", column: "id" },
      42,
    );
    expect(sql).toBe(
      `SELECT * FROM "public"."users" WHERE "id" = '42' LIMIT 100 OFFSET 0`,
    );
  });

  it("maintains a back stack", () => {
    const s = new FkStack();
    expect(s.canGoBack()).toBe(false);
    s.push({ label: "orders", tabState: { a: 1 } });
    s.push({ label: "users", tabState: { a: 2 } });
    expect(s.depth()).toBe(2);
    expect(s.pop()!.label).toBe("users");
    expect(s.canGoBack()).toBe(true);
    s.pop();
    expect(s.canGoBack()).toBe(false);
  });
});
