// Auto-updater integration (S9.3). Wraps the Tauri updater + process plugins.
// Update delivery needs the release/update server configured in
// tauri.conf.json → plugins.updater.endpoints.
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/** Returns an available Update, or null if up to date. */
export async function checkForUpdate(): Promise<Update | null> {
  return check();
}

/** Download + install an update, then relaunch. */
export async function installUpdate(update: Update): Promise<void> {
  await update.downloadAndInstall();
  await relaunch();
}
