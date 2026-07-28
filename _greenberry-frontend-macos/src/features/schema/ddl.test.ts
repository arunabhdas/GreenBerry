import { describe, it, expect } from "vitest";
import {
  buildCreateTable,
  buildAlter,
  buildCreateIndex,
  buildDropIndex,
  buildAddConstraint,
} from "./ddl";
import { buildErd } from "./erd";
import type { Catalog } from "../../lib/db";

describe("buildCreateTable", () => {
  it("emits columns, NOT NULL, defaults, and a PK", () => {
    const sql = buildCreateTable("postgres", { schema: "public", name: "users" }, [
      { name: "id", type: "serial", nullable: false, primaryKey: true },
      { name: "email", type: "text", nullable: false },
      { name: "active", type: "boolean", default: "true" },
    ]);
    expect(sql).toBe(
      'CREATE TABLE "public"."users" (\n' +
        '  "id" serial NOT NULL,\n' +
        '  "email" text NOT NULL,\n' +
        '  "active" boolean DEFAULT true,\n' +
        '  PRIMARY KEY ("id")\n);',
    );
  });
});

describe("buildAlter", () => {
  it("generates add/drop/rename/default/notnull", () => {
    const t = { name: "t" };
    expect(buildAlter("postgres", t, [{ kind: "addColumn", column: { name: "n", type: "int" } }])).toEqual(
      ['ALTER TABLE "t" ADD COLUMN "n" int;'],
    );
    expect(buildAlter("postgres", t, [{ kind: "dropColumn", name: "n" }])).toEqual([
      'ALTER TABLE "t" DROP COLUMN "n";',
    ]);
    expect(buildAlter("postgres", t, [{ kind: "renameColumn", from: "a", to: "b" }])).toEqual([
      'ALTER TABLE "t" RENAME COLUMN "a" TO "b";',
    ]);
    expect(buildAlter("postgres", t, [{ kind: "setNotNull", name: "a", notNull: false }])).toEqual([
      'ALTER TABLE "t" ALTER COLUMN "a" DROP NOT NULL;',
    ]);
  });
});

describe("indexes & constraints", () => {
  it("creates a unique index", () => {
    expect(
      buildCreateIndex("postgres", { name: "users" }, { name: "u_email", columns: ["email"], unique: true }),
    ).toBe('CREATE UNIQUE INDEX "u_email" ON "users" ("email");');
  });
  it("drops an index (mysql needs the table)", () => {
    expect(buildDropIndex("postgres", "i1")).toBe('DROP INDEX "i1";');
    expect(buildDropIndex("mysql", "i1", { name: "t" })).toBe("DROP INDEX `i1` ON `t`;");
  });
  it("adds a foreign key constraint", () => {
    expect(
      buildAddConstraint("postgres", { name: "orders" }, {
        kind: "foreignKey",
        name: "fk_user",
        columns: ["user_id"],
        refTable: { name: "users" },
        refColumns: ["id"],
        onDelete: "CASCADE",
      }),
    ).toBe(
      'ALTER TABLE "orders" ADD CONSTRAINT "fk_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE;',
    );
  });
});

describe("buildErd (S6.4)", () => {
  it("lays out nodes on a grid and edges from FKs", () => {
    const catalog: Catalog = {
      schemas: [
        {
          name: "public",
          tables: [
            { name: "users", kind: "table", columns: [{ name: "id", dataType: "int", nullable: false, primaryKey: true }] },
            {
              name: "orders",
              kind: "table",
              columns: [
                {
                  name: "user_id",
                  dataType: "int",
                  nullable: true,
                  primaryKey: false,
                  references: { schema: "public", table: "users", column: "id" },
                },
              ],
            },
          ],
        },
      ],
    };
    const erd = buildErd(catalog, 4);
    expect(erd.nodes.map((n) => n.label)).toEqual(["users", "orders"]);
    expect(erd.nodes[0]).toMatchObject({ x: 0, y: 0 });
    expect(erd.edges).toEqual([{ from: "public.orders", to: "public.users" }]);
  });
});
