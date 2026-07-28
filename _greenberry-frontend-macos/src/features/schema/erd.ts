// ERD graph model (S6.4): grid-layout nodes from the catalog, edges from FKs.
import type { Catalog } from "../../lib/db";

export interface ErdNode {
  id: string;
  label: string;
  x: number;
  y: number;
}
export interface ErdEdge {
  from: string;
  to: string;
}

export function buildErd(
  catalog: Catalog,
  cols = 4,
  spacingX = 220,
  spacingY = 160,
): { nodes: ErdNode[]; edges: ErdEdge[] } {
  const nodes: ErdNode[] = [];
  const edges: ErdEdge[] = [];
  const tid = (schema: string, table: string) => `${schema}.${table}`;
  let i = 0;
  for (const s of catalog.schemas) {
    for (const t of s.tables) {
      nodes.push({
        id: tid(s.name, t.name),
        label: t.name,
        x: (i % cols) * spacingX,
        y: Math.floor(i / cols) * spacingY,
      });
      for (const c of t.columns) {
        if (c.references) {
          edges.push({
            from: tid(s.name, t.name),
            to: tid(c.references.schema, c.references.table),
          });
        }
      }
      i++;
    }
  }
  return { nodes, edges };
}
