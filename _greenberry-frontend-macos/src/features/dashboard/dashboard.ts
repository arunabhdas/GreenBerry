// Dashboard canvas model + linking (S7.2, S7.3, S7.4).
export type WidgetKind = "chart" | "table" | "text" | "input" | "date" | "button";

export interface Widget {
  id: string;
  kind: WidgetKind;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: unknown;
  bindVar?: string; // component value bound to a dashboard variable
}

export const WIDGET_LIBRARY: WidgetKind[] = [
  "chart",
  "table",
  "text",
  "input",
  "date",
  "button",
];

export class DashboardModel {
  private widgets: Widget[];

  constructor(initial: Widget[] = []) {
    this.widgets = [...initial];
  }

  list(): Widget[] {
    return this.widgets;
  }
  add(w: Widget) {
    this.widgets = [...this.widgets, w];
  }
  remove(id: string) {
    this.widgets = this.widgets.filter((w) => w.id !== id);
  }
  move(id: string, x: number, y: number) {
    this.widgets = this.widgets.map((w) => (w.id === id ? { ...w, x, y } : w));
  }
  resize(id: string, w: number, h: number) {
    this.widgets = this.widgets.map((x) => (x.id === id ? { ...x, w, h } : x));
  }
  setBinding(id: string, variable: string) {
    this.widgets = this.widgets.map((w) =>
      w.id === id ? { ...w, bindVar: variable } : w,
    );
  }
  duplicate(id: string): string | null {
    const src = this.widgets.find((w) => w.id === id);
    if (!src) return null;
    const copy: Widget = {
      ...src,
      id: `${src.id}-copy${this.widgets.length}`,
      x: src.x + 20,
      y: src.y + 20,
    };
    this.widgets = [...this.widgets, copy];
    return copy.id;
  }
}

/** Master-detail linking: a clicked row maps columns → dashboard variables. */
export function rowToVariables(
  columns: string[],
  row: unknown[],
  mapping: Record<string, string>, // column -> variable name
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [col, varName] of Object.entries(mapping)) {
    const i = columns.indexOf(col);
    if (i >= 0) out[varName] = String(row[i]);
  }
  return out;
}
