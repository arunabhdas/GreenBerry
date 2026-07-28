// Sidebar schema tree (S3.1): build a tree from the introspection Catalog and
// filter it (keeping tables whose name or any column matches).
import type { Catalog } from "../../lib/db";

export type TreeKind = "schema" | "table" | "view" | "column";

export interface TreeNode {
  id: string;
  label: string;
  kind: TreeKind;
  children?: TreeNode[];
  sub?: string; // e.g. column type
}

export function buildTree(catalog: Catalog): TreeNode[] {
  return catalog.schemas.map((s) => ({
    id: `schema:${s.name}`,
    label: s.name,
    kind: "schema" as const,
    children: s.tables.map((t) => ({
      id: `table:${s.name}.${t.name}`,
      label: t.name,
      kind: (t.kind === "view" ? "view" : "table") as TreeKind,
      children: t.columns.map((c) => ({
        id: `col:${s.name}.${t.name}.${c.name}`,
        label: c.name,
        kind: "column" as const,
        sub: c.dataType + (c.primaryKey ? " · pk" : ""),
      })),
    })),
  }));
}

/** Filter to tables (and their schemas) matching the query by table or column. */
export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const out: TreeNode[] = [];
  for (const schema of nodes) {
    const tables = (schema.children ?? []).filter((table) => {
      if (table.label.toLowerCase().includes(q)) return true;
      return (table.children ?? []).some((col) =>
        col.label.toLowerCase().includes(q),
      );
    });
    if (tables.length) out.push({ ...schema, children: tables });
  }
  return out;
}
