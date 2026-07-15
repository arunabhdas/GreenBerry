// Keyboard shortcuts (S1.6). Arctype's documented defaults, remappable via
// workspace settings (an overrides map). `mod` = Cmd on macOS / Ctrl elsewhere.
import { useEffect } from "react";

export type ActionId =
  | "run"
  | "runSelection"
  | "save"
  | "format"
  | "comment"
  | "home"
  | "closeTab"
  | "settings"
  | "palette"
  | "newQuery"
  | `tab${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

export const DEFAULT_KEYMAP: Record<string, string> = {
  run: "mod+enter",
  runSelection: "mod+shift+enter",
  save: "mod+s",
  format: "mod+alt+f",
  comment: "mod+/",
  home: "mod+0",
  closeTab: "mod+w",
  settings: "mod+,",
  palette: "mod+k",
  newQuery: "mod+t",
  tab1: "mod+1",
  tab2: "mod+2",
  tab3: "mod+3",
  tab4: "mod+4",
  tab5: "mod+5",
  tab6: "mod+6",
  tab7: "mod+7",
  tab8: "mod+8",
  tab9: "mod+9",
};

/** Does a keyboard event match a chord like "mod+shift+enter"? */
export function matchChord(e: KeyboardEvent, chord: string): boolean {
  const parts = chord.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const wantMod = parts.includes("mod");
  const wantShift = parts.includes("shift");
  const wantAlt = parts.includes("alt");

  const mod = e.metaKey || e.ctrlKey;
  if (wantMod !== mod) return false;
  if (wantShift !== e.shiftKey) return false;
  if (wantAlt !== e.altKey) return false;

  const evKey = e.key.toLowerCase();
  if (evKey === key) return true;
  // On macOS, Option+<letter> mutates e.key; fall back to physical code.
  if (key.length === 1 && /[a-z0-9]/.test(key)) {
    const code = (e.code || "").toLowerCase();
    return code === `key${key}` || code === `digit${key}`;
  }
  return false;
}

/** Merge default bindings with user overrides (from settings). */
export function resolveKeymap(
  overrides: Record<string, string> = {},
): Record<string, string> {
  return { ...DEFAULT_KEYMAP, ...overrides };
}

/** Which action (if any) a key event triggers under a keymap. */
export function resolveAction(
  e: KeyboardEvent,
  keymap: Record<string, string>,
): string | null {
  for (const [action, chord] of Object.entries(keymap)) {
    if (matchChord(e, chord)) return action;
  }
  return null;
}

export type ShortcutHandlers = Partial<Record<string, (e: KeyboardEvent) => void>>;

/** Attach global shortcut handling. Returns nothing; cleans up on unmount. */
export function useShortcuts(
  handlers: ShortcutHandlers,
  overrides?: Record<string, string>,
): void {
  useEffect(() => {
    const keymap = resolveKeymap(overrides);
    const onKey = (e: KeyboardEvent) => {
      const action = resolveAction(e, keymap);
      if (action && handlers[action]) {
        e.preventDefault();
        handlers[action]!(e);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers, overrides]);
}
