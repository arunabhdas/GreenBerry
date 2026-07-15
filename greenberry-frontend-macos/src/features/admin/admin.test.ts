import { describe, it, expect } from "vitest";
import {
  buildSessionsQuery,
  buildKillQuery,
  buildGrant,
  buildRevoke,
  buildMaintenance,
  buildPgDumpArgs,
  buildMetricsQuery,
} from "./admin";

describe("admin (E8)", () => {
  it("builds a sessions query per engine (S8.1)", () => {
    expect(buildSessionsQuery("postgres")).toContain("pg_stat_activity");
    expect(buildSessionsQuery("mysql")).toContain("processlist");
  });

  it("builds kill/terminate queries (S8.1)", () => {
    expect(buildKillQuery("postgres", 123)).toBe("SELECT pg_cancel_backend(123);");
    expect(buildKillQuery("postgres", 123, true)).toBe(
      "SELECT pg_terminate_backend(123);",
    );
    expect(buildKillQuery("mysql", 7)).toBe("KILL QUERY 7;");
  });

  it("builds GRANT / REVOKE (S8.2)", () => {
    const g = { privileges: ["SELECT", "INSERT"], onObject: '"public"."users"', role: "app" };
    expect(buildGrant("postgres", g)).toBe(
      'GRANT SELECT, INSERT ON "public"."users" TO "app";',
    );
    expect(buildRevoke("postgres", g)).toBe(
      'REVOKE SELECT, INSERT ON "public"."users" FROM "app";',
    );
  });

  it("builds maintenance statements (S8.3)", () => {
    expect(buildMaintenance("postgres", "vacuum-analyze", "t")).toBe('VACUUM ANALYZE "t";');
    expect(buildMaintenance("postgres", "reindex", "t")).toBe('REINDEX TABLE "t";');
    expect(buildMaintenance("mysql", "vacuum", "t")).toBe("OPTIMIZE TABLE `t`;");
  });

  it("builds pg_dump args (S8.3)", () => {
    const args = buildPgDumpArgs(
      { engine: "postgres", host: "h", port: 5432, user: "u", database: "d" },
      { format: "custom", file: "/tmp/out.dump" },
    );
    expect(args).toEqual([
      "-h", "h", "-p", "5432", "-U", "u", "-d", "d", "-F", "c", "-f", "/tmp/out.dump",
    ]);
  });

  it("builds a metrics query (S8.4)", () => {
    expect(buildMetricsQuery("postgres")).toContain("pg_stat_database");
  });
});
