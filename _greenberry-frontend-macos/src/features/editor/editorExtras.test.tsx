import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { searchSaved, searchHistory, queriesByFolder } from "./savedQueries";
import { chunk, RowBuffer } from "./streaming";
import { SqlEditor } from "./SqlEditor";
import type { SavedQuery, HistoryItem } from "../../lib/workspace";

describe("savedQueries (S5.7)", () => {
  const saved: SavedQuery[] = [
    { id: "1", name: "Active users", sql: "select * from users where active" },
    { id: "2", name: "Orders", sql: "select * from orders", folder: "Reports" },
  ];
  it("searches by name or sql", () => {
    expect(searchSaved(saved, "active").map((x) => x.id)).toEqual(["1"]);
    expect(searchSaved(saved, "orders").map((x) => x.id)).toEqual(["2"]);
  });
  it("searches history by sql", () => {
    const hist: HistoryItem[] = [
      { id: "h1", sql: "select 1", ts: 1, status: "ok" },
      { id: "h2", sql: "drop table t", ts: 2, status: "ok" },
    ];
    expect(searchHistory(hist, "drop").map((x) => x.id)).toEqual(["h2"]);
  });
  it("groups by folder", () => {
    const g = queriesByFolder(saved);
    expect(Object.keys(g).sort()).toEqual(["Reports", "Unfiled"]);
  });
});

describe("streaming (S5.5)", () => {
  it("chunks arrays", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("accumulates row batches", () => {
    const b = new RowBuffer();
    b.append([[1], [2]]);
    b.append([[3]]);
    expect(b.count).toBe(3);
    expect(b.slice(0, 2)).toEqual([[1], [2]]);
  });
});

describe("SqlEditor (S5.1)", () => {
  it("runs on click and on Cmd+Enter", () => {
    const onRun = vi.fn();
    render(<SqlEditor value="select 1" onChange={() => {}} onRun={onRun} />);
    fireEvent.click(screen.getByLabelText("run"));
    fireEvent.keyDown(screen.getByLabelText("sql editor"), {
      key: "Enter",
      metaKey: true,
    });
    expect(onRun).toHaveBeenCalledTimes(2);
  });

  it("formats via the toolbar", () => {
    const onChange = vi.fn();
    render(
      <SqlEditor value="select a from t" onChange={onChange} onRun={() => {}} />,
    );
    fireEvent.click(screen.getByLabelText("format"));
    expect(onChange).toHaveBeenCalledWith("SELECT a\nFROM t");
  });

  it("shows detected query variables", () => {
    render(
      <SqlEditor
        value="select * from t where id={{userId}}"
        onChange={() => {}}
        onRun={() => {}}
      />,
    );
    const panel = screen.getByLabelText("query variables");
    expect(panel).toHaveTextContent("userId");
  });
});
