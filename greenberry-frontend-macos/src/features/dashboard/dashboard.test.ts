import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mapSeries, chartDependsOn, type ChartSpec } from "./chart";
import { DashboardModel, rowToVariables, type Widget } from "./dashboard";
import { clampInterval, RefreshScheduler, MIN_REFRESH_MS } from "./refresh";

describe("chart mapping (S7.1)", () => {
  it("maps X labels and numeric Y series", () => {
    const spec: ChartSpec = { type: "bar", x: "month", y: ["revenue", "cost"] };
    const { labels, series } = mapSeries(
      ["month", "revenue", "cost"],
      [
        ["Jan", "100", "40"],
        ["Feb", "120", "50"],
      ],
      spec,
    );
    expect(labels).toEqual(["Jan", "Feb"]);
    expect(series[0]).toEqual({ name: "revenue", values: [100, 120] });
    expect(series[1]).toEqual({ name: "cost", values: [40, 50] });
  });

  it("tracks the source-query dependency (S7.6)", () => {
    const spec: ChartSpec = { type: "line", x: "t", y: ["v"], sourceQueryId: "q1" };
    expect(chartDependsOn(spec, "q1")).toBe(true);
    expect(chartDependsOn(spec, "q2")).toBe(false);
  });
});

describe("DashboardModel (S7.2/S7.3/S7.4)", () => {
  const w = (id: string): Widget => ({ id, kind: "chart", x: 0, y: 0, w: 4, h: 3 });

  it("adds, moves, resizes, removes", () => {
    const d = new DashboardModel();
    d.add(w("a"));
    d.move("a", 40, 60);
    d.resize("a", 6, 4);
    expect(d.list()[0]).toMatchObject({ x: 40, y: 60, w: 6, h: 4 });
    d.remove("a");
    expect(d.list()).toHaveLength(0);
  });

  it("duplicates with an offset", () => {
    const d = new DashboardModel([w("a")]);
    const id = d.duplicate("a");
    expect(id).toBeTruthy();
    expect(d.list()).toHaveLength(2);
    expect(d.list()[1]).toMatchObject({ x: 20, y: 20 });
  });

  it("binds a row click to variables", () => {
    const vars = rowToVariables(
      ["id", "name"],
      [42, "Ada"],
      { id: "userId", name: "userName" },
    );
    expect(vars).toEqual({ userId: "42", userName: "Ada" });
  });
});

describe("RefreshScheduler (S7.5)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("clamps to the 1-minute minimum", () => {
    expect(clampInterval(1000)).toBe(MIN_REFRESH_MS);
    expect(clampInterval(120_000)).toBe(120_000);
  });

  it("fires on the interval and stops", () => {
    const fn = vi.fn();
    const s = new RefreshScheduler(fn);
    s.start(MIN_REFRESH_MS);
    expect(s.running).toBe(true);
    vi.advanceTimersByTime(MIN_REFRESH_MS * 2);
    expect(fn).toHaveBeenCalledTimes(2);
    s.stop();
    expect(s.running).toBe(false);
  });
});
