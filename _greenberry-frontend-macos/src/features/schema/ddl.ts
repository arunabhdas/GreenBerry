// DDL builders for schema editing (E6). Forms emit reviewable SQL; the app
// applies it via the staged/transaction path (S4.5).
import type { Engine } from "../../lib/db";
import { qualifyTable, quoteIdent, type TableRef } from "../grid/sqlBuilder";

export interface ColumnDef {
  name: string;
  type: string;
  nullable?: boolean; // default true
  default?: string; // raw SQL expression
  primaryKey?: boolean;
}

export function buildCreateTable(
  engine: Engine,
  table: TableRef,
  columns: ColumnDef[],
): string {
  const id = (x: string) => quoteIdent(engine, x);
  const lines = columns.map((c) => {
    let s = `  ${id(c.name)} ${c.type}`;
    if (c.nullable === false) s += " NOT NULL";
    if (c.default !== undefined) s += ` DEFAULT ${c.default}`;
    return s;
  });
  const pks = columns.filter((c) => c.primaryKey).map((c) => id(c.name));
  if (pks.length) lines.push(`  PRIMARY KEY (${pks.join(", ")})`);
  return `CREATE TABLE ${qualifyTable(engine, table)} (\n${lines.join(",\n")}\n);`;
}

export type AlterOp =
  | { kind: "addColumn"; column: ColumnDef }
  | { kind: "dropColumn"; name: string }
  | { kind: "renameColumn"; from: string; to: string }
  | { kind: "setDefault"; name: string; default: string | null }
  | { kind: "setNotNull"; name: string; notNull: boolean };

export function buildAlter(
  engine: Engine,
  table: TableRef,
  ops: AlterOp[],
): string[] {
  const t = qualifyTable(engine, table);
  const id = (x: string) => quoteIdent(engine, x);
  return ops.map((op): string => {
    switch (op.kind) {
      case "addColumn": {
        let s = `ALTER TABLE ${t} ADD COLUMN ${id(op.column.name)} ${op.column.type}`;
        if (op.column.nullable === false) s += " NOT NULL";
        if (op.column.default !== undefined) s += ` DEFAULT ${op.column.default}`;
        return s + ";";
      }
      case "dropColumn":
        return `ALTER TABLE ${t} DROP COLUMN ${id(op.name)};`;
      case "renameColumn":
        return `ALTER TABLE ${t} RENAME COLUMN ${id(op.from)} TO ${id(op.to)};`;
      case "setDefault":
        return op.default === null
          ? `ALTER TABLE ${t} ALTER COLUMN ${id(op.name)} DROP DEFAULT;`
          : `ALTER TABLE ${t} ALTER COLUMN ${id(op.name)} SET DEFAULT ${op.default};`;
      case "setNotNull":
        return `ALTER TABLE ${t} ALTER COLUMN ${id(op.name)} ${
          op.notNull ? "SET" : "DROP"
        } NOT NULL;`;
    }
  });
}

export interface IndexDef {
  name: string;
  columns: string[];
  unique?: boolean;
}

export function buildCreateIndex(
  engine: Engine,
  table: TableRef,
  idx: IndexDef,
): string {
  const cols = idx.columns.map((c) => quoteIdent(engine, c)).join(", ");
  return `CREATE ${idx.unique ? "UNIQUE " : ""}INDEX ${quoteIdent(
    engine,
    idx.name,
  )} ON ${qualifyTable(engine, table)} (${cols});`;
}

export function buildDropIndex(
  engine: Engine,
  name: string,
  table?: TableRef,
): string {
  if (engine === "mysql" && table) {
    return `DROP INDEX ${quoteIdent(engine, name)} ON ${qualifyTable(engine, table)};`;
  }
  return `DROP INDEX ${quoteIdent(engine, name)};`;
}

export type ConstraintDef =
  | { kind: "unique"; name: string; columns: string[] }
  | { kind: "check"; name: string; expr: string }
  | {
      kind: "foreignKey";
      name: string;
      columns: string[];
      refTable: TableRef;
      refColumns: string[];
      onDelete?: string;
    };

export function buildAddConstraint(
  engine: Engine,
  table: TableRef,
  c: ConstraintDef,
): string {
  const t = qualifyTable(engine, table);
  const id = (x: string) => quoteIdent(engine, x);
  const cols = (arr: string[]) => arr.map(id).join(", ");
  const head = `ALTER TABLE ${t} ADD CONSTRAINT ${id(c.name)}`;
  switch (c.kind) {
    case "unique":
      return `${head} UNIQUE (${cols(c.columns)});`;
    case "check":
      return `${head} CHECK (${c.expr});`;
    case "foreignKey": {
      let s = `${head} FOREIGN KEY (${cols(c.columns)}) REFERENCES ${qualifyTable(
        engine,
        c.refTable,
      )} (${cols(c.refColumns)})`;
      if (c.onDelete) s += ` ON DELETE ${c.onDelete}`;
      return s + ";";
    }
  }
}
