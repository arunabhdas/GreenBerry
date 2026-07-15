// Staged-changes engine (S4.5 ★). Pending cell edits / inserts / deletes
// accumulate, render as a SQL preview, and commit in one transaction — never
// immediate-commit. This is GreenBerry's headline safety feature over Arctype.
import type { Engine } from "../../lib/db";
import { qualifyTable, quoteIdent, quoteLiteral, type TableRef } from "./sqlBuilder";

export type Row = Record<string, unknown>;

interface PendingUpdate {
  pk: Row;
  set: Row;
}
interface PendingInsert {
  tempId: string;
  values: Row;
}
interface PendingDelete {
  pk: Row;
}

export function valueLiteral(engine: Engine, v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean")
    return engine === "postgres" ? (v ? "TRUE" : "FALSE") : v ? "1" : "0";
  if (typeof v === "object") return quoteLiteral(JSON.stringify(v));
  return quoteLiteral(String(v));
}

export class StagedChanges {
  private updates = new Map<string, PendingUpdate>();
  private inserts: PendingInsert[] = [];
  private deletes = new Map<string, PendingDelete>();

  constructor(
    private engine: Engine,
    private table: TableRef,
    private pkCols: string[],
  ) {}

  private key(pk: Row): string {
    return JSON.stringify(this.pkCols.map((c) => pk[c]));
  }

  editCell(pk: Row, column: string, value: unknown) {
    const k = this.key(pk);
    const existing = this.updates.get(k) ?? { pk, set: {} };
    existing.set[column] = value;
    this.updates.set(k, existing);
  }

  insertRow(values: Row): string {
    const tempId = `new-${this.inserts.length + 1}`;
    this.inserts.push({ tempId, values });
    return tempId;
  }

  deleteRow(pk: Row) {
    const k = this.key(pk);
    this.updates.delete(k); // a delete supersedes edits
    this.deletes.set(k, { pk });
  }

  isDirty(): boolean {
    return this.updates.size + this.inserts.length + this.deletes.size > 0;
  }

  count(): number {
    return this.updates.size + this.inserts.length + this.deletes.size;
  }

  clear() {
    this.updates.clear();
    this.inserts = [];
    this.deletes.clear();
  }

  private tbl(): string {
    return qualifyTable(this.engine, this.table);
  }
  private ident(id: string): string {
    return quoteIdent(this.engine, id);
  }
  private lit(v: unknown): string {
    return valueLiteral(this.engine, v);
  }
  private whereByPk(pk: Row): string {
    return this.pkCols
      .map((c) => `${this.ident(c)} = ${this.lit(pk[c])}`)
      .join(" AND ");
  }

  /** Ordered SQL statements to apply the pending changes. */
  previewSql(): string[] {
    const out: string[] = [];
    for (const del of this.deletes.values()) {
      out.push(`DELETE FROM ${this.tbl()} WHERE ${this.whereByPk(del.pk)};`);
    }
    for (const up of this.updates.values()) {
      const assigns = Object.entries(up.set)
        .map(([c, v]) => `${this.ident(c)} = ${this.lit(v)}`)
        .join(", ");
      out.push(
        `UPDATE ${this.tbl()} SET ${assigns} WHERE ${this.whereByPk(up.pk)};`,
      );
    }
    for (const ins of this.inserts) {
      const cols = Object.keys(ins.values);
      const vals = cols.map((c) => this.lit(ins.values[c]));
      out.push(
        `INSERT INTO ${this.tbl()} (${cols
          .map((c) => this.ident(c))
          .join(", ")}) VALUES (${vals.join(", ")});`,
      );
    }
    return out;
  }
}
