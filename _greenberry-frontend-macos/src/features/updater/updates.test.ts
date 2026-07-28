import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn() }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));

import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { checkForUpdate, installUpdate } from "./updates";

describe("updater (S9.3)", () => {
  beforeEach(() => {
    vi.mocked(check).mockReset();
    vi.mocked(relaunch).mockReset();
  });

  it("checks for an update", async () => {
    vi.mocked(check).mockResolvedValue({ version: "1.2.0" } as never);
    const u = await checkForUpdate();
    expect(u?.version).toBe("1.2.0");
    expect(check).toHaveBeenCalled();
  });

  it("returns null when up to date", async () => {
    vi.mocked(check).mockResolvedValue(null as never);
    expect(await checkForUpdate()).toBeNull();
  });

  it("installs then relaunches", async () => {
    const update = { downloadAndInstall: vi.fn().mockResolvedValue(undefined) };
    await installUpdate(update as never);
    expect(update.downloadAndInstall).toHaveBeenCalled();
    expect(relaunch).toHaveBeenCalled();
  });
});
