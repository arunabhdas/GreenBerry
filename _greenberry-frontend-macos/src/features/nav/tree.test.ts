import { describe, it, expect } from "vitest";
import { buildTree, filterTree } from "./tree";
import type { Catalog } from "../../lib/db";

const catalog: Catalog = {
  schemas: [
    {
      name: "public",
      tables: [
        {
          name: "users",
          kind: "table",
          columns: [
            { name: "id", dataType: "integer", nullable: false, primaryKey: true },
            { name: "email", dataType: "text", nullable: true, primaryKey: false },
          ],
        },
        {
          name: "orders",
          kind: "table",
          columns: [
            { name: "user_id", dataType: "integer", nullable: false, primaryKey: false },
          ],
        },
        { name: "v_report", kind: "view", columns: [] },
      ],
    },
  ],
};

describe("tree", () => {
  it("builds schema → table → column", () => {
    const t = buildTree(catalog);
    expect(t[0].kind).toBe("schema");
    expect(t[0].children!.map((x) => x.label)).toEqual([
      "users",
      "orders",
      "v_report",
    ]);
    const users = t[0].children![0];
    expect(users.children!.map((c) => c.label)).toEqual(["id", "email"]);
    expect(users.children![0].sub).toContain("pk");
    expect(t[0].children![2].kind).toBe("view");
  });

  it("filters by table name or column", () => {
    const tables = filterTree(buildTree(catalog), "user")[0].children!.map(
      (x) => x.label,
    );
    expect(tables).toContain("users"); // name match
    expect(tables).toContain("orders"); // column user_id match
    expect(tables).not.toContain("v_report");
  });

  it("returns empty when nothing matches", () => {
    expect(filterTree(buildTree(catalog), "zzz")).toEqual([]);
  });
});
