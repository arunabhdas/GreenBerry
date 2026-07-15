import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Home } from "./Home";

const steps = [
  { id: "a", label: "Connect a database", done: true },
  { id: "b", label: "Run a query", done: false },
];

describe("Home", () => {
  it("shows onboarding progress and steps", () => {
    render(<Home steps={steps} />);
    expect(screen.getByLabelText("onboarding progress")).toHaveTextContent("1/2");
    expect(screen.getByText(/Run a query/)).toBeInTheDocument();
  });

  it("fires the primary actions", () => {
    const onNewQuery = vi.fn();
    const onAddConnection = vi.fn();
    render(
      <Home steps={steps} onNewQuery={onNewQuery} onAddConnection={onAddConnection} />,
    );
    fireEvent.click(screen.getByText("New Query"));
    fireEvent.click(screen.getByText("Add Connection"));
    expect(onNewQuery).toHaveBeenCalled();
    expect(onAddConnection).toHaveBeenCalled();
  });

  it("opens a recent connection", () => {
    const onOpenRecent = vi.fn();
    render(
      <Home
        steps={steps}
        recent={[{ id: "c1", name: "local pg" }]}
        onOpenRecent={onOpenRecent}
      />,
    );
    fireEvent.click(screen.getByText("local pg"));
    expect(onOpenRecent).toHaveBeenCalledWith("c1");
  });
});
