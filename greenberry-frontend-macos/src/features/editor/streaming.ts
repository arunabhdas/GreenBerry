// Batched/streamed result rendering (S5.5): chunk large results and accumulate
// progressively so first rows paint immediately while the count ticks up.
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export class RowBuffer {
  private rows: unknown[][] = [];

  append(batch: unknown[][]) {
    for (const r of batch) this.rows.push(r);
  }
  get count(): number {
    return this.rows.length;
  }
  slice(start: number, end: number): unknown[][] {
    return this.rows.slice(start, end);
  }
  all(): unknown[][] {
    return this.rows;
  }
  clear() {
    this.rows = [];
  }
}
