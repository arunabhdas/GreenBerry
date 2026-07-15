// Saved queries + history search/grouping (S5.7). Persistence lives in the
// workspace store; these are the search/organize helpers over it.
import type { HistoryItem, SavedQuery } from "../../lib/workspace";

export function searchSaved(items: SavedQuery[], q: string): SavedQuery[] {
  if (!q) return items;
  const s = q.toLowerCase();
  return items.filter(
    (x) => x.name.toLowerCase().includes(s) || x.sql.toLowerCase().includes(s),
  );
}

export function searchHistory(items: HistoryItem[], q: string): HistoryItem[] {
  if (!q) return items;
  const s = q.toLowerCase();
  return items.filter((x) => x.sql.toLowerCase().includes(s));
}

export function queriesByFolder(
  items: SavedQuery[],
): Record<string, SavedQuery[]> {
  const out: Record<string, SavedQuery[]> = {};
  for (const q of items) (out[q.folder ?? "Unfiled"] ??= []).push(q);
  return out;
}
