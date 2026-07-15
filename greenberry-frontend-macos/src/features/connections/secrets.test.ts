import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { sanitizeForStore, withSecret } from "./secrets";

const mockInvoke = vi.mocked(invoke);

describe("secrets", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("sanitizeForStore strips the password", () => {
    const { config, hasSecret } = sanitizeForStore({
      engine: "postgres",
      host: "h",
      port: 5432,
      user: "u",
      password: "p",
      database: "d",
    });
    expect("password" in config).toBe(false);
    expect(hasSecret).toBe(true);
  });

  it("sanitizeForStore reports no secret when absent", () => {
    const { hasSecret } = sanitizeForStore({
      engine: "postgres",
      host: "h",
      port: 5432,
      user: "u",
      database: "d",
    });
    expect(hasSecret).toBe(false);
  });

  it("withSecret pulls the password from the keychain when missing", async () => {
    mockInvoke.mockResolvedValue("kc-pass");
    const merged = await withSecret("id1", {
      engine: "postgres",
      host: "h",
      port: 5432,
      user: "u",
      database: "d",
    });
    expect(merged.password).toBe("kc-pass");
    expect(mockInvoke).toHaveBeenCalledWith("secret_get", {
      service: "com.greenberry.desktop",
      account: "id1",
    });
  });

  it("withSecret keeps an already-present password", async () => {
    const merged = await withSecret("id1", {
      engine: "postgres",
      host: "h",
      port: 5432,
      user: "u",
      password: "already",
      database: "d",
    });
    expect(merged.password).toBe("already");
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
