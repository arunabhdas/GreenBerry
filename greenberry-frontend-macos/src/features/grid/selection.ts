// Rectangular multi-cell selection → clipboard TSV (S4.7).
export interface Cell {
  r: number;
  c: number;
}
export interface CellRange {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export function normalizeRange(a: Cell, b: Cell): CellRange {
  return {
    r1: Math.min(a.r, b.r),
    c1: Math.min(a.c, b.c),
    r2: Math.max(a.r, b.r),
    c2: Math.max(a.c, b.c),
  };
}

export function rangeToTsv(rows: unknown[][], range: CellRange): string {
  const out: string[] = [];
  for (let r = range.r1; r <= range.r2; r++) {
    const cells: string[] = [];
    for (let c = range.c1; c <= range.c2; c++) {
      const v = rows[r]?.[c];
      cells.push(v == null ? "" : String(v));
    }
    out.push(cells.join("\t"));
  }
  return out.join("\n");
}

export function rangeSize(range: CellRange): number {
  return (range.r2 - range.r1 + 1) * (range.c2 - range.c1 + 1);
}
