// Fuzzy subsequence matching for the Cmd+K palette (S3.3).
export function fuzzyMatch(text: string, query: string): number | null {
  if (query === "") return 0;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let ti = 0;
  let score = 0;
  let streak = 0;
  for (const c of q) {
    const idx = t.indexOf(c, ti);
    if (idx === -1) return null;
    if (idx === ti) {
      streak += 1;
      score += 2 + streak; // reward contiguous runs
    } else {
      streak = 0;
      score += 1;
    }
    const prev = idx === 0 ? "" : t[idx - 1];
    if (idx === 0 || prev === " " || prev === "_" || prev === ".") score += 3; // word boundary
    ti = idx + 1;
  }
  return score - text.length * 0.01; // slight preference for shorter matches
}

export function fuzzySearch<T extends { label: string }>(
  items: T[],
  query: string,
): T[] {
  if (!query) return items;
  return items
    .map((it) => ({ it, score: fuzzyMatch(it.label, query) }))
    .filter((x): x is { it: T; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.it);
}

export function groupByType<T extends { type: string }>(
  items: T[],
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const it of items) (out[it.type] ??= []).push(it);
  return out;
}
