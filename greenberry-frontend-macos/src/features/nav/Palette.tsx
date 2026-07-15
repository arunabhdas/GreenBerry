import { useEffect, useState } from "react";
import { fuzzySearch, groupByType } from "../../lib/fuzzy";

export interface PaletteItem {
  id: string;
  label: string;
  type: string;
  run: () => void;
}

export function Palette({
  items,
  onClose,
}: {
  items: PaletteItem[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);

  const results = fuzzySearch(items, query);
  const grouped = groupByType(results);

  useEffect(() => setSel(0), [query]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(results.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[sel]?.run();
      onClose();
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <div className="gb-palette" role="dialog" aria-label="Quick find">
      <input
        autoFocus
        aria-label="quick find"
        className="gb-palette__input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Search tables, queries, commands…"
      />
      <ul className="gb-palette__list" role="listbox">
        {Object.entries(grouped).map(([type, group]) => (
          <li key={type} role="group" aria-label={type}>
            <div className="gb-palette__group">{type}</div>
            {group.map((it) => {
              const index = results.indexOf(it);
              return (
                <div
                  key={it.id}
                  role="option"
                  aria-selected={index === sel}
                  className={`gb-palette__item ${index === sel ? "is-active" : ""}`.trim()}
                  onMouseEnter={() => setSel(index)}
                  onClick={() => {
                    it.run();
                    onClose();
                  }}
                >
                  {it.label}
                </div>
              );
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}
