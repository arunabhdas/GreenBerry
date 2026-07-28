import { describe, it, expect } from "vitest";
import { extractVariables, substituteVariables } from "./variables";
import { completions } from "./complete";
import { formatSql } from "./format";
import { filterRows } from "./resultsSearch";
import { parseExplainJson } from "./explain";
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
            { name: "id", dataType: "int4", nullable: false, primaryKey: true },
            { name: "email", dataType: "text", nullable: true, primaryKey: false },
          ],
        },
        {
          name: "orders",
          kind: "table",
          columns: [
            { name: "user_id", dataType: "int4", nullable: false, primaryKey: false },
          ],
        },
      ],
    },
  ],
};

describe("query variables", () => {
  it("extracts unique names", () => {
    expect(
      extractVariables("where a={{x}} and b={{ y }} and c={{x}}"),
    ).toEqual(["x", "y"]);
  });
  it("substitutes provided values, leaves the rest", () => {
    expect(substituteVariables("a={{x}} b={{y}}", { x: "1" })).toBe("a=1 b={{y}}");
  });
});

describe("completions", () => {
  it("filters tables/columns/keywords by prefix", () => {
    const c = completions(catalog, "us").map((x) => x.label);
    expect(c).toContain("users");
    expect(c).toContain("user_id");
    expect(completions(catalog, "sel").map((x) => x.label)).toContain("SELECT");
  });
});

describe("formatSql", () => {
  it("uppercases keywords, breaks clauses, and is idempotent", () => {
    const f = formatSql("select a,b from t where x=1");
    expect(f).toBe("SELECT a,b\nFROM t\nWHERE x=1");
    expect(formatSql(f)).toBe(f);
  });
});

describe("filterRows", () => {
  it("returns matching row indices", () => {
    const rows = [
      ["Ada", "x"],
      ["Grace", "y"],
      ["Alan", "z"],
    ];
    expect(filterRows(rows, "gr")).toEqual([1]);
    expect(filterRows(rows, "")).toEqual([0, 1, 2]);
  });
});

describe("parseExplainJson", () => {
  it("builds a plan tree with cost heat", () => {
    const json = JSON.stringify([
      {
        Plan: {
          "Node Type": "Hash Join",
          "Total Cost": 200,
          "Plan Rows": 10,
          Plans: [
            { "Node Type": "Seq Scan", "Total Cost": 200, "Plan Rows": 1000 },
            { "Node Type": "Index Scan", "Total Cost": 50, "Plan Rows": 10 },
          ],
        },
      },
    ]);
    const tree = parseExplainJson(json);
    expect(tree.nodeType).toBe("Hash Join");
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].nodeType).toBe("Seq Scan");
    expect(tree.children[0].heat).toBe(1);
    expect(tree.children[1].heat).toBeCloseTo(0.25);
  });
});
