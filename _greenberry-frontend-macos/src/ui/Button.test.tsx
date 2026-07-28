import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("applies variant and size classes", () => {
    render(
      <Button variant="primary" size="sm">
        Go
      </Button>,
    );
    const b = screen.getByRole("button", { name: "Go" });
    expect(b.className).toContain("gb-btn--primary");
    expect(b.className).toContain("gb-btn--sm");
  });

  it("fires onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByText("Click"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not fire when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        No
      </Button>,
    );
    fireEvent.click(screen.getByText("No"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
