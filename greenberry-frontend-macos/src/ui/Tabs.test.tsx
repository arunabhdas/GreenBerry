import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs, type TabItem } from "./Tabs";

const items: TabItem[] = [
  { id: "a", title: "Alpha" },
  { id: "b", title: "Beta", dirty: true },
];

describe("Tabs", () => {
  it("marks active tab and selects on click", () => {
    const onSelect = vi.fn();
    render(<Tabs items={items} activeId="a" onSelect={onSelect} />);
    expect(
      screen.getByRole("tab", { name: /Alpha/ }).getAttribute("aria-selected"),
    ).toBe("true");
    fireEvent.click(screen.getByText("Beta"));
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("renders a dirty indicator and closes", () => {
    const onClose = vi.fn();
    render(
      <Tabs items={items} activeId="a" onSelect={() => {}} onClose={onClose} />,
    );
    expect(screen.getByLabelText("unsaved changes")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("close Beta"));
    expect(onClose).toHaveBeenCalledWith("b");
  });
});
