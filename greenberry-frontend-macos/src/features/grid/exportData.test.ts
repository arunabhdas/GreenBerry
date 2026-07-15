import { describe, it, expect } from "vitest";
import { toCsv, toJson, parseCsv, mapColumns } from "./exportData";

describe("exportData", () => {
  it("toCsv escapes commas, quotes, newlines", () => {
    const csv = toCsv(
      ["a", "b"],
      [
        ["x", "y,z"],
        ['he said "hi"', "line\nbreak"],
      ],
    );
    expect(csv).toBe(`a,b\nx,"y,z"\n"he said ""hi""","line\nbreak"`);
  });

  it("round-trips through parseCsv", () => {
    const columns = ["id", "name"];
    const rows = [
      ["1", "a,b"],
      ["2", 'q"q'],
    ];
    const parsed = parseCsv(toCsv(columns, rows));
    expect(parsed.headers).toEqual(columns);
    expect(parsed.rows).toEqual(rows);
  });

  it("toJson builds row objects", () => {
    expect(JSON.parse(toJson(["a", "b"], [[1, 2]]))).toEqual([{ a: 1, b: 2 }]);
  });

  it("mapColumns maps source headers to target columns", () => {
    const parsed = parseCsv("full_name,years\nAda,30\n");
    const mapped = mapColumns(parsed, { name: "full_name", age: "years" }, [
      "name",
      "age",
    ]);
    expect(mapped).toEqual([{ name: "Ada", age: "30" }]);
  });
});
