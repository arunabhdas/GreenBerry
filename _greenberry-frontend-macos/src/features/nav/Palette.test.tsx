import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Palette, type PaletteItem } from "./Palette";

function makeItems(): PaletteItem[] {
  return [
    { id: "1", label: "users", type: "table", run: vi.fn() },
    { id: "2", label: "user_roles", type: "table", run: vi.fn() },
    { id: "3", label: "Run query", type: "command", run: vi.fn() },
  ];
}

describe("Palette", () => {
  it("filters and runs the best match on Enter", () => {
    const items = makeItems();
    const onClose = vi.fn();
    render(<Palette items={items} onClose={onClose} />);
    const input = screen.getByLabelText("quick find");
    fireEvent.change(input, { target: { value: "users" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(items[0].run).toHaveBeenCalled(); // "users" ranks first
    expect(onClose).toHaveBeenCalled();
  });

  it("groups results by type", () => {
    render(<Palette items={makeItems()} onClose={() => {}} />);
    expect(screen.getByRole("group", { name: "table" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "command" })).toBeInTheDocument();
  });

  it("ArrowDown moves selection", () => {
    const items = makeItems();
    render(<Palette items={items} onClose={() => {}} />);
    const input = screen.getByLabelText("quick find");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(items[1].run).toHaveBeenCalled(); // second item
  });
});
