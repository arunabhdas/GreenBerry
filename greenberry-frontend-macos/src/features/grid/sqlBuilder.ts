// SQL builder for filter/sort pills + pagination (S4.3, S4.4, S4.2).
// Engine-aware identifier quoting and LIKE/ILIKE.
import type { Engine } from "../../lib/db";

export type FilterOp =
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "contains"
  | "startsWith"
  | "endsWith"
  | "isNull"
  | "notNull"
  | "in";

export interface Filter {
  column: string;
  op: FilterOp;
  value?: string;
}
export interface Sort {
  column: string;
  dir: "asc" | "desc";
}
export interface Page {
  limit: number;
  offset: number;
}
export interface TableRef {
  schema?: string;
  name: string;
}

export function quoteIdent(engine: Engine, id: string): string {
  if (engine === "mysql") return "`" + id.replace(/`/g, "``") + "`";
  if (engine === "mssql") return "[" + id.replace(/]/g, "]]") + "]";
  return '"' + id.replace(/"/g, '""') + '"'; // postgres, sqlite
}

export function quoteLiteral(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'";
}

function likeOp(engine: Engine): string {
  return engine === "postgres" ? "ILIKE" : "LIKE";
}

export function buildWhere(engine: Engine, filters: Filter[]): string {
  if (!filters.length) return "";
  const parts = filters.map((f) => {
    const col = quoteIdent(engine, f.column);
    const v = f.value ?? "";
    switch (f.op) {
      case "isNull":
        return `${col} IS NULL`;
      case "notNull":
        return `${col} IS NOT NULL`;
      case "contains":
        return `${col} ${likeOp(engine)} ${quoteLiteral("%" + v + "%")}`;
      case "startsWith":
        return `${col} ${likeOp(engine)} ${quoteLiteral(v + "%")}`;
      case "endsWith":
        return `${col} ${likeOp(engine)} ${quoteLiteral("%" + v)}`;
      case "in":
        return `${col} IN (${v
          .split(",")
          .map((x) => quoteLiteral(x.trim()))
          .join(", ")})`;
      default:
        return `${col} ${f.op} ${quoteLiteral(v)}`;
    }
  });
  return " WHERE " + parts.join(" AND ");
}

export function buildOrderBy(engine: Engine, sorts: Sort[]): string {
  if (!sorts.length) return "";
  return (
    " ORDER BY " +
    sorts
      .map((s) => `${quoteIdent(engine, s.column)} ${s.dir.toUpperCase()}`)
      .join(", ")
  );
}

export function qualifyTable(engine: Engine, t: TableRef): string {
  return t.schema
    ? `${quoteIdent(engine, t.schema)}.${quoteIdent(engine, t.name)}`
    : quoteIdent(engine, t.name);
}

export function buildSelect(
  engine: Engine,
  table: TableRef,
  filters: Filter[] = [],
  sorts: Sort[] = [],
  page?: Page,
): string {
  let sql = `SELECT * FROM ${qualifyTable(engine, table)}`;
  sql += buildWhere(engine, filters);
  sql += buildOrderBy(engine, sorts);
  if (page) {
    sql +=
      engine === "mssql"
        ? ` OFFSET ${page.offset} ROWS FETCH NEXT ${page.limit} ROWS ONLY`
        : ` LIMIT ${page.limit} OFFSET ${page.offset}`;
  }
  return sql;
}
