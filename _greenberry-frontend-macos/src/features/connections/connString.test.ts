import { describe, it, expect } from "vitest";
import { buildConnectionUrl, PASSWORD_MASK } from "./connString";
import { parseConnectionUrl } from "./parseUrl";
import type { ConnectionConfig } from "../../lib/db";

const pg: ConnectionConfig = {
  engine: "postgres",
  host: "db.internal",
  port: 6543,
  user: "ada",
  password: "s3cret",
  database: "appdb",
};

describe("buildConnectionUrl", () => {
  it("renders a full postgres URL with the password", () => {
    expect(buildConnectionUrl(pg)).toBe("postgres://ada:s3cret@db.internal:6543/appdb");
  });

  it("masks the password for display", () => {
    const url = buildConnectionUrl(pg, { maskPassword: true });
    expect(url).toBe(`postgres://ada:${PASSWORD_MASK}@db.internal:6543/appdb`);
    expect(url).not.toContain("s3cret");
  });

  it("omits the auth block cleanly when there is no user/password", () => {
    expect(
      buildConnectionUrl({ ...pg, user: "", password: undefined }),
    ).toBe("postgres://db.internal:6543/appdb");
    expect(buildConnectionUrl({ ...pg, password: undefined })).toBe(
      "postgres://ada@db.internal:6543/appdb",
    );
  });

  it("renders sqlite as a file URL and appends sslmode when set", () => {
    expect(
      buildConnectionUrl({ engine: "sqlite", host: "", port: 0, user: "", database: "/tmp/x.db" }),
    ).toBe("sqlite:///tmp/x.db");
    expect(buildConnectionUrl({ ...pg, sslMode: "verify-full" })).toBe(
      "postgres://ada:s3cret@db.internal:6543/appdb?sslmode=verify-full",
    );
  });

  it("percent-encodes reserved characters and round-trips through parseUrl", () => {
    const cfg = { ...pg, user: "a d@a", password: "p:a/ss" };
    const url = buildConnectionUrl(cfg);
    expect(url).toBe("postgres://a%20d%40a:p%3Aa%2Fss@db.internal:6543/appdb");
    const parsed = parseConnectionUrl(url);
    expect(parsed.user).toBe("a d@a");
    expect(parsed.password).toBe("p:a/ss");
    expect(parsed.database).toBe("appdb");
  });
});
