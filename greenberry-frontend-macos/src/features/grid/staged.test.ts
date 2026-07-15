import { describe, it, expect } from "vitest";
import { StagedChanges } from "./staged";

const mk = () =>
  new StagedChanges("postgres", { schema: "public", name: "users" }, ["id"]);

describe("StagedChanges", () => {
  it("stages cell edits as one UPDATE", () => {
    const s = mk();
    s.editCell({ id: 1 }, "name", "Ada");
    s.editCell({ id: 1 }, "active", true);
    expect(s.isDirty()).toBe(true);
    expect(s.previewSql()).toEqual([
      `UPDATE "public"."users" SET "name" = 'Ada', "active" = TRUE WHERE "id" = 1;`,
    ]);
  });

  it("stages inserts", () => {
    const s = mk();
    s.insertRow({ name: "Grace", active: false });
    expect(s.previewSql()[0]).toBe(
      `INSERT INTO "public"."users" ("name", "active") VALUES ('Grace', FALSE);`,
    );
  });

  it("delete supersedes a pending edit", () => {
    const s = mk();
    s.editCell({ id: 2 }, "name", "x");
    s.deleteRow({ id: 2 });
    expect(s.previewSql()).toEqual([`DELETE FROM "public"."users" WHERE "id" = 2;`]);
  });

  it("serializes null and json literals", () => {
    const s = mk();
    s.editCell({ id: 3 }, "meta", { a: 1 });
    s.editCell({ id: 3 }, "note", null);
    expect(s.previewSql()[0]).toBe(
      `UPDATE "public"."users" SET "meta" = '{"a":1}', "note" = NULL WHERE "id" = 3;`,
    );
  });

  it("clear resets to not-dirty", () => {
    const s = mk();
    s.insertRow({ a: 1 });
    expect(s.count()).toBe(1);
    s.clear();
    expect(s.isDirty()).toBe(false);
  });
});
