import { describe, it, expect } from "vitest";
import { fuzzyMatch, fuzzySearch, groupByType } from "./fuzzy";

describe("fuzzy", () => {
  it("matches subsequences, rejects non-matches", () => {
    expect(fuzzyMatch("users", "us")).not.toBeNull();
    expect(fuzzyMatch("users", "xyz")).toBeNull();
    expect(fuzzyMatch("anything", "")).toBe(0);
  });

  it("ranks prefix/contiguous higher than scattered", () => {
    const prefix = fuzzyMatch("user_sessions", "user")!;
    const scattered = fuzzyMatch("power_users", "user")!;
    expect(prefix).toBeGreaterThan(scattered);
  });

  it("sorts search results best-first and drops non-matches", () => {
    const items = [
      { label: "power_users" },
      { label: "users" },
      { label: "user_roles" },
      { label: "orders" },
    ];
    const r = fuzzySearch(items, "user").map((x) => x.label);
    expect(r[0]).toBe("users");
    expect(r).not.toContain("orders");
  });

  it("groups by type", () => {
    const g = groupByType([
      { type: "table" },
      { type: "query" },
      { type: "table" },
    ]);
    expect(g.table).toHaveLength(2);
    expect(g.query).toHaveLength(1);
  });
});
