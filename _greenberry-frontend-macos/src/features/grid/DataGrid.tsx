import { useState } from "react";
import type { ColumnInfo } from "../../lib/db";
import { visibleRange } from "./gridWindow";
import { formatCell } from "./inspect";

export interface DataGridProps {
  columns: ColumnInfo[];
  rows: unknown[][];
  rowHeight?: number;
  height?: number;
  colWidth?: number;
  selected?: { r: number; c: number } | null;
  onCellClick?: (r: number, c: number) => void;
}

/** Virtualized data grid (S4.1): frozen header, windowed rows, NULL styling. */
export function DataGrid({
  columns,
  rows,
  rowHeight = 28,
  height = 400,
  colWidth = 160,
  selected,
  onCellClick,
}: DataGridProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const { start, end } = visibleRange(scrollTop, rowHeight, height, rows.length);
  const visible = rows.slice(start, end);

  return (
    <div className="gb-grid" role="grid" aria-rowcount={rows.length}>
      <div className="gb-grid__header" role="row">
        <div className="gb-grid__rownum">#</div>
        {columns.map((c) => (
          <div
            key={c.name}
            role="columnheader"
            className="gb-grid__th"
            style={{ width: colWidth }}
          >
            <span className="gb-grid__colname">{c.name}</span>{" "}
            <span className="gb-grid__type">{c.dataType}</span>
          </div>
        ))}
      </div>

      <div
        className="gb-grid__body"
        style={{ height, overflow: "auto" }}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div style={{ height: rows.length * rowHeight, position: "relative" }}>
          {visible.map((row, i) => {
            const r = start + i;
            return (
              <div
                key={r}
                role="row"
                className="gb-grid__row"
                style={{ position: "absolute", top: r * rowHeight, height: rowHeight }}
              >
                <div className="gb-grid__rownum">{r + 1}</div>
                {columns.map((col, c) => {
                  const v = row[c];
                  const isSel = selected?.r === r && selected?.c === c;
                  return (
                    <div
                      key={col.name}
                      role="gridcell"
                      aria-selected={isSel}
                      className={`gb-grid__cell ${isSel ? "is-selected" : ""} ${
                        v == null ? "is-null" : ""
                      }`.trim()}
                      style={{ width: colWidth }}
                      onClick={() => onCellClick?.(r, c)}
                    >
                      {v == null ? "NULL" : formatCell(v)}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
