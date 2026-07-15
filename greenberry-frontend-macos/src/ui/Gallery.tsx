import { useState } from "react";
import { Button } from "./Button";
import { Tabs, type TabItem } from "./Tabs";
import { IconRail, type RailItem } from "./IconRail";
import { useTheme } from "./theme";
import { useToast } from "./Toast";

const RAIL: RailItem[] = [
  { id: "tables", label: "Tables", icon: "▤" },
  { id: "queries", label: "Queries", icon: "›_" },
  { id: "dashboards", label: "Charts", icon: "▦" },
];

const TABS: TabItem[] = [
  { id: "t1", title: "public.users" },
  { id: "t2", title: "Untitled Query", dirty: true },
  { id: "t3", title: "dashboard-default" },
];

/**
 * Storybook-equivalent (S1.4): renders the core components live so the design
 * system can be eyeballed in both themes. Reachable in-app at `#gallery`.
 */
export function Gallery() {
  const { theme, toggleTheme, zoom, zoomIn, zoomOut, resetZoom } = useTheme();
  const { notify } = useToast();
  const [rail, setRail] = useState("tables");
  const [tab, setTab] = useState("t1");
  const [tabs, setTabs] = useState(TABS);

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--bg)", color: "var(--text)" }}>
      <IconRail items={RAIL} activeId={rail} onSelect={setRail} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Tabs
          items={tabs}
          activeId={tab}
          onSelect={setTab}
          onClose={(id) => setTabs((ts) => ts.filter((t) => t.id !== id))}
        />
        <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <section>
            <h3>Buttons</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="primary">Primary</Button>
              <Button>Default</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button size="sm" variant="primary">Small</Button>
              <Button disabled>Disabled</Button>
            </div>
          </section>

          <section>
            <h3>Toasts</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <Button onClick={() => notify("Connection saved", "success")}>Success</Button>
              <Button onClick={() => notify("Query failed: syntax error", "error")}>Error</Button>
              <Button onClick={() => notify("Streaming results…", "info")}>Info</Button>
            </div>
          </section>

          <section>
            <h3>Theme &amp; zoom</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Button onClick={toggleTheme}>Theme: {theme}</Button>
              <Button variant="ghost" onClick={zoomOut}>−</Button>
              <span style={{ color: "var(--dim)" }}>{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" onClick={zoomIn}>+</Button>
              <Button variant="ghost" onClick={resetZoom}>Reset</Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
