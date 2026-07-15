// Chart specs + data mapping (S7.1, S7.6). Turns a result set into labels +
// numeric series based on chosen X/Y columns.
export type ChartType = "bar" | "line" | "pie" | "area";

export interface ChartSpec {
  type: ChartType;
  x: string;
  y: string[];
  sourceQueryId?: string;
}

export interface Series {
  name: string;
  values: number[];
}

export function mapSeries(
  columns: string[],
  rows: unknown[][],
  spec: ChartSpec,
): { labels: string[]; series: Series[] } {
  const xi = columns.indexOf(spec.x);
  const labels = rows.map((r) => String(r[xi]));
  const series = spec.y.map((y) => {
    const yi = columns.indexOf(y);
    return {
      name: y,
      values: rows.map((r) => {
        const n = Number(r[yi]);
        return Number.isFinite(n) ? n : 0;
      }),
    };
  });
  return { labels, series };
}

/** Charts fed by a saved query depend on it (edit query → refresh charts). */
export function chartDependsOn(spec: ChartSpec, queryId: string): boolean {
  return spec.sourceQueryId === queryId;
}
