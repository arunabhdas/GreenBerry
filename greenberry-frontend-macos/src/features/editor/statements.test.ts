import { describe, it, expect } from "vitest";
import { splitStatements, statementAtOffset } from "./statements";

describe("splitStatements", () => {
  it("splits on semicolons", () => {
    expect(splitStatements("select 1; select 2").map((x) => x.sql)).toEqual([
      "select 1",
      "select 2",
    ]);
  });

  it("ignores semicolons inside strings and comments", () => {
    expect(splitStatements("select ';'").map((x) => x.sql)).toEqual(["select ';'"]);
    expect(
      splitStatements("select 1 -- a; b\n; select 2").map((x) => x.sql),
    ).toEqual(["select 1 -- a; b", "select 2"]);
    expect(
      splitStatements("select 1 /* ; */ ; select 2").map((x) => x.sql),
    ).toEqual(["select 1 /* ; */", "select 2"]);
  });

  it("finds the statement at a cursor offset", () => {
    const script = "select 1; select 2";
    expect(statementAtOffset(script, 12)?.sql).toBe("select 2");
    expect(statementAtOffset(script, 3)?.sql).toBe("select 1");
  });
});
