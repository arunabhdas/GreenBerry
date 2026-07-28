import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./theme";

function Probe() {
  const { theme, toggleTheme, zoom, zoomIn } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="zoom">{zoom}</span>
      <button onClick={toggleTheme}>toggle</button>
      <button onClick={zoomIn}>zoomin</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  it("sets data-theme on <html> and toggles", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement.dataset.theme).toBe("dark");
    fireEvent.click(screen.getByText("toggle"));
    expect(screen.getByTestId("theme").textContent).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("zoom in updates state and root font-size", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText("zoomin"));
    expect(screen.getByTestId("zoom").textContent).toBe("1.1");
    expect(document.documentElement.style.fontSize).toBe(`${14 * 1.1}px`);
  });

  it("Cmd+= triggers zoom", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    fireEvent.keyDown(window, { key: "=", metaKey: true });
    expect(screen.getByTestId("zoom").textContent).toBe("1.1");
  });
});
