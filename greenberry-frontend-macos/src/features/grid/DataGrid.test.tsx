import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataGrid } from "./DataGrid";
import { CellInspector } from "./CellInspector";
import type { ColumnInfo } from "../../lib/db";

const columns: ColumnInfo[] = [
  { name: "id", dataType: "int4" },
  { name: "name", dataType: "text" },
];

describe("DataGrid", () => {
  it("renders headers with types", () => {
    render(<DataGrid columns={columns} rows={[[1, "Ada"]]} />);
    expect(screen.getByRole("columnheader", { name: /id/ })).toBeInTheDocument();
    expect(screen.getByText("text")).toBeInTheDocument();
  });

  it("renders NULL cells and fires onCellClick", () => {
    const onCellClick = vi.fn();
    render(<DataGrid columns={columns} rows={[[1, null]]} onCellClick={onCellClick} />);
    expect(screen.getByText("NULL")).toBeInTheDocument();
    fireEvent.click(screen.getByText("NULL"));
    expect(onCellClick).toHaveBeenCalledWith(0, 1);
  });

  it("virtualizes: only a window of rows is rendered", () => {
    const rows = Array.from({ length: 1000 }, (_, i) => [i, `r${i}`]);
    render(<DataGrid columns={columns} rows={rows} rowHeight={20} height={100} />);
    // header row + a small window, never 1000 rows
    const rendered = screen.getAllByRole("row").length;
    expect(rendered).toBeLessThan(30);
    expect(rendered).toBeGreaterThan(1);
  });
});

describe("CellInspector", () => {
  it("pretty-prints JSON and copies", () => {
    const onCopy = vi.fn();
    render(<CellInspector value={{ a: 1 }} onCopy={onCopy} />);
    expect(screen.getByText("JSON")).toBeInTheDocument();
    expect(screen.getByText(/"a": 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("copy value"));
    expect(onCopy).toHaveBeenCalledWith('{\n  "a": 1\n}');
  });

  it("shows plain values", () => {
    render(<CellInspector value="hello" />);
    expect(screen.getByText("Value")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
