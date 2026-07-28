import { describe, it, expect } from "vitest";
import { normalizeRange, rangeToTsv, rangeSize } from "./selection";
import { visibleRange } from "./gridWindow";
import { formatCell, isJsonLike, prettyJson, tryParseJson } from "./inspect";

describe("selection", () => {
  const rows = [
    ["a1", "b1", "c1"],
    ["a2", "b2", "c2"],
    ["a3", "b3", "c3"],
  ];

  it("normalizes a range regardless of drag direction", () => {
    expect(normalizeRange({ r: 2, c: 2 }, { r: 0, c: 1 })).toEqual({
      r1: 0,
      c1: 1,
      r2: 2,
      c2: 2,
    });
  });

  it("extracts a TSV rectangle", () => {
    const range = normalizeRange({ r: 0, c: 1 }, { r: 1, c: 2 });
    expect(rangeToTsv(rows, range)).toBe("b1\tc1\nb2\tc2");
    expect(rangeSize(range)).toBe(4);
  });
});

describe("gridWindow", () => {
  it("computes the visible window with overscan", () => {
    // rowHeight 20, viewport 100 => 5 visible; scrollTop 200 => first row 10
    expect(visibleRange(200, 20, 100, 1000, 3)).toEqual({ start: 7, end: 18 });
  });
  it("clamps to bounds", () => {
    expect(visibleRange(0, 20, 100, 4, 3)).toEqual({ start: 0, end: 4 });
  });
});

describe("inspect", () => {
  it("formats cells", () => {
    expect(formatCell(null)).toBe("NULL");
    expect(formatCell({ a: 1 })).toBe('{"a":1}');
    expect(formatCell(42)).toBe("42");
  });
  it("detects json-like values", () => {
    expect(isJsonLike({ a: 1 })).toBe(true);
    expect(isJsonLike('{"a":1}')).toBe(true);
    expect(isJsonLike("hello")).toBe(false);
  });
  it("pretty-prints json (parsing strings)", () => {
    expect(prettyJson('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(tryParseJson("not json")).toBeUndefined();
  });
});
