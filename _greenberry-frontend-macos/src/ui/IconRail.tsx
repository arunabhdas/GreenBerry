import type { ReactNode } from "react";

export interface RailItem {
  id: string;
  label: string;
  icon: ReactNode;
}

export interface IconRailProps {
  items: RailItem[];
  activeId: string;
  onSelect: (id: string) => void;
  footer?: ReactNode;
}

export function IconRail({ items, activeId, onSelect, footer }: IconRailProps) {
  return (
    <nav className="gb-rail" aria-label="Primary">
      <div className="gb-rail__group">
        {items.map((it) => {
          const active = it.id === activeId;
          return (
            <button
              key={it.id}
              type="button"
              title={it.label}
              aria-current={active ? "page" : undefined}
              className={`gb-rail__item ${active ? "is-active" : ""}`.trim()}
              onClick={() => onSelect(it.id)}
            >
              <span className="gb-rail__icon" aria-hidden>
                {it.icon}
              </span>
              <span className="gb-rail__label">{it.label}</span>
            </button>
          );
        })}
      </div>
      {footer ? <div className="gb-rail__footer">{footer}</div> : null}
    </nav>
  );
}
