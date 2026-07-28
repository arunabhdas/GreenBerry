import { describe, it, expect } from "vitest";
import { TabsStore, type Tab } from "./tabsStore";

const tab = (id: string): Tab => ({ id, kind: "query", title: id });

describe("TabsStore", () => {
  it("opens, activates, and dedupes by id", () => {
    const s = new TabsStore();
    s.open(tab("a"));
    s.open(tab("b"));
    s.open(tab("a"));
    expect(s.getTabs().map((t) => t.id)).toEqual(["a", "b"]);
    expect(s.getActiveId()).toBe("a");
  });

  it("closing the active tab activates a neighbor", () => {
    const s = new TabsStore();
    ["a", "b", "c"].forEach((id) => s.open(tab(id)));
    s.select("b");
    s.close("b");
    expect(s.getActiveId()).toBe("c");
    s.close("c");
    expect(s.getActiveId()).toBe("a");
    s.close("a");
    expect(s.getActiveId()).toBeNull();
  });

  it("closeOthers keeps a single tab", () => {
    const s = new TabsStore();
    ["a", "b", "c"].forEach((id) => s.open(tab(id)));
    s.closeOthers("b");
    expect(s.getTabs().map((t) => t.id)).toEqual(["b"]);
    expect(s.getActiveId()).toBe("b");
  });

  it("setDirty flags the tab", () => {
    const s = new TabsStore();
    s.open(tab("a"));
    s.setDirty("a", true);
    expect(s.getTabs()[0].dirty).toBe(true);
  });
});
