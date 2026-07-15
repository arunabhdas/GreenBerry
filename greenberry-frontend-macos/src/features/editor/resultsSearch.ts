// Search-filter across a result set (S5.8): returns matching row indices.
export function filterRows(rows: unknown[][], query: string): number[] {
  if (!query) return rows.map((_, i) => i);
  const q = query.toLowerCase();
  const out: number[] = [];
  rows.forEach((row, i) => {
    if (row.some((v) => v != null && String(v).toLowerCase().includes(q))) {
      out.push(i);
    }
  });
  return out;
}
