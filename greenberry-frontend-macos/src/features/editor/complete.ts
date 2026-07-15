// Autocomplete provider (S5.2): keywords + tables + columns from the cached
// catalog, filtered by the current prefix.
import type { Catalog } from "../../lib/db";

export type CompletionKind = "keyword" | "table" | "column" | "schema";
export interface Completion {
  label: string;
  kind: CompletionKind;
  detail?: string;
}

const KEYWORDS = [
  "SELECT", "FROM", "WHERE", "JOIN", "LEFT JOIN", "INNER JOIN", "GROUP BY",
  "ORDER BY", "HAVING", "LIMIT", "OFFSET", "INSERT INTO", "UPDATE", "DELETE FROM",
  "VALUES", "SET", "AND", "OR", "NOT", "NULL", "AS", "ON", "DISTINCT", "COUNT",
  "SUM", "AVG", "MIN", "MAX", "RETURNING",
];

export function completions(catalog: Catalog, prefix: string): Completion[] {
  const p = prefix.toLowerCase();
  const out: Completion[] = [];
  const seenCols = new Set<string>();

  for (const schema of catalog.schemas) {
    for (const table of schema.tables) {
      out.push({ label: table.name, kind: "table", detail: schema.name });
      for (const col of table.columns) {
        const key = `${col.name}`;
        if (!seenCols.has(key)) {
          seenCols.add(key);
          out.push({ label: col.name, kind: "column", detail: col.dataType });
        }
      }
    }
  }
  for (const k of KEYWORDS) out.push({ label: k, kind: "keyword" });

  return out.filter((c) => c.label.toLowerCase().startsWith(p));
}
