import { describe, it, expect } from "vitest";
import { parseConnectionUrl } from "./parseUrl";

describe("parseConnectionUrl", () => {
  it("parses a full postgres URL with sslmode", () => {
    const c = parseConnectionUrl(
      "postgresql://ada:s3cr3t@db.example.com:6543/appdb?sslmode=require",
    );
    expect(c).toEqual({
      engine: "postgres",
      host: "db.example.com",
      port: 6543,
      user: "ada",
      password: "s3cr3t",
      database: "appdb",
      sslMode: "require",
    });
  });

  it("defaults the port per engine", () => {
    expect(parseConnectionUrl("postgres://u@h/d").port).toBe(5432);
    expect(parseConnectionUrl("mysql://u@h/d").port).toBe(3306);
    expect(parseConnectionUrl("sqlserver://u@h/d").port).toBe(1433);
  });

  it("maps aliases to engines", () => {
    expect(parseConnectionUrl("mariadb://u@h/d").engine).toBe("mysql");
    expect(parseConnectionUrl("mssql://u@h/d").engine).toBe("mssql");
  });

  it("decodes percent-encoded credentials", () => {
    const c = parseConnectionUrl("postgres://a%40b:p%3Aw@h:5432/d");
    expect(c.user).toBe("a@b");
    expect(c.password).toBe("p:w");
  });

  it("parses a sqlite file path", () => {
    const c = parseConnectionUrl("sqlite:///Users/me/data.db");
    expect(c.engine).toBe("sqlite");
    expect(c.database).toBe("/Users/me/data.db");
  });

  it("throws on garbage", () => {
    expect(() => parseConnectionUrl("not a url")).toThrow();
    expect(() => parseConnectionUrl("mongodb://h/d")).toThrow(/unknown engine/);
  });
});
