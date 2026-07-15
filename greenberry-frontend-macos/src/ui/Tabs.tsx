export interface TabItem {
  id: string;
  title: string;
  dirty?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose?: (id: string) => void;
}

export function Tabs({ items, activeId, onSelect, onClose }: TabsProps) {
  return (
    <div className="gb-tabs" role="tablist">
      {items.map((t) => {
        const active = t.id === activeId;
        return (
          <div
            key={t.id}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            className={`gb-tab ${active ? "is-active" : ""}`.trim()}
            onClick={() => onSelect(t.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSelect(t.id);
            }}
          >
            <span className="gb-tab__title">{t.title}</span>
            {t.dirty ? (
              <span className="gb-tab__dirty" aria-label="unsaved changes" />
            ) : null}
            {onClose ? (
              <button
                type="button"
                className="gb-tab__close"
                aria-label={`close ${t.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(t.id);
                }}
              >
                ×
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
