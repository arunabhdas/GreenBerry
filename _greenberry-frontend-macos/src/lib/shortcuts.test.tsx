import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  matchChord,
  resolveAction,
  resolveKeymap,
  useShortcuts,
  DEFAULT_KEYMAP,
} from "./shortcuts";

function keyEvent(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", init);
}

describe("matchChord", () => {
  it("matches mod+enter", () => {
    expect(matchChord(keyEvent({ key: "Enter", metaKey: true }), "mod+enter")).toBe(true);
    expect(matchChord(keyEvent({ key: "Enter", ctrlKey: true }), "mod+enter")).toBe(true);
    expect(matchChord(keyEvent({ key: "Enter" }), "mod+enter")).toBe(false);
  });

  it("respects shift and alt", () => {
    expect(
      matchChord(keyEvent({ key: "Enter", metaKey: true, shiftKey: true }), "mod+shift+enter"),
    ).toBe(true);
    expect(
      matchChord(keyEvent({ key: "Enter", metaKey: true }), "mod+shift+enter"),
    ).toBe(false);
  });

  it("falls back to physical code for alt+letter (macOS)", () => {
    // Option+F on macOS yields a mangled key but code "KeyF".
    expect(
      matchChord(keyEvent({ key: "ƒ", code: "KeyF", metaKey: true, altKey: true }), "mod+alt+f"),
    ).toBe(true);
  });

  it("matches digits for tab shortcuts", () => {
    expect(matchChord(keyEvent({ key: "1", metaKey: true }), "mod+1")).toBe(true);
  });
});

describe("resolveKeymap / resolveAction", () => {
  it("merges overrides over defaults", () => {
    const km = resolveKeymap({ run: "mod+r" });
    expect(km.run).toBe("mod+r");
    expect(km.save).toBe(DEFAULT_KEYMAP.save);
  });

  it("resolves the action for an event", () => {
    const km = resolveKeymap();
    expect(resolveAction(keyEvent({ key: "s", metaKey: true }), km)).toBe("save");
    expect(resolveAction(keyEvent({ key: "k", metaKey: true }), km)).toBe("palette");
    expect(resolveAction(keyEvent({ key: "x" }), km)).toBeNull();
  });
});

describe("useShortcuts", () => {
  function Harness({ handlers, overrides }: { handlers: any; overrides?: any }) {
    useShortcuts(handlers, overrides);
    return null;
  }

  it("dispatches the mapped handler", () => {
    const run = vi.fn();
    const save = vi.fn();
    render(<Harness handlers={{ run, save }} />);
    fireEvent.keyDown(window, { key: "Enter", metaKey: true });
    fireEvent.keyDown(window, { key: "s", metaKey: true });
    expect(run).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledOnce();
  });

  it("honors remapped bindings", () => {
    const run = vi.fn();
    render(<Harness handlers={{ run }} overrides={{ run: "mod+r" }} />);
    fireEvent.keyDown(window, { key: "Enter", metaKey: true }); // old binding
    expect(run).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "r", metaKey: true }); // new binding
    expect(run).toHaveBeenCalledOnce();
  });
});
