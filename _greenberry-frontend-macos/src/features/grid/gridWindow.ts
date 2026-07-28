// Virtualization windowing math for the data grid (S4.1).
export interface WindowRange {
  start: number;
  end: number; // exclusive
}

export function visibleRange(
  scrollTop: number,
  rowHeight: number,
  viewportHeight: number,
  total: number,
  overscan = 3,
): WindowRange {
  const first = Math.floor(scrollTop / rowHeight);
  const visible = Math.ceil(viewportHeight / rowHeight);
  const start = Math.max(0, first - overscan);
  const end = Math.min(total, first + visible + overscan);
  return { start, end };
}
