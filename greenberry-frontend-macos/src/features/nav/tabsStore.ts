// Tab model (S3.2). Open/close/select/close-others with neighbor activation
// and a dirty flag (for confirm-close of running queries).
export type TabKind = "home" | "table" | "query" | "dashboard";

export interface Tab {
  id: string;
  kind: TabKind;
  title: string;
  dirty?: boolean;
  payload?: unknown;
}

export class TabsStore {
  private tabs: Tab[] = [];
  private activeId: string | null = null;
  private listeners = new Set<() => void>();

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  private emit() {
    this.listeners.forEach((l) => l());
  }

  getTabs = (): Tab[] => this.tabs;
  getActiveId = (): string | null => this.activeId;

  open(tab: Tab) {
    if (!this.tabs.some((t) => t.id === tab.id)) this.tabs = [...this.tabs, tab];
    this.activeId = tab.id;
    this.emit();
  }

  select(id: string) {
    if (this.tabs.some((t) => t.id === id)) {
      this.activeId = id;
      this.emit();
    }
  }

  close(id: string) {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    this.tabs = this.tabs.filter((t) => t.id !== id);
    if (this.activeId === id) {
      const neighbor = this.tabs[idx] ?? this.tabs[idx - 1] ?? null;
      this.activeId = neighbor ? neighbor.id : null;
    }
    this.emit();
  }

  closeOthers(id: string) {
    this.tabs = this.tabs.filter((t) => t.id === id);
    this.activeId = this.tabs.length ? id : null;
    this.emit();
  }

  setDirty(id: string, dirty: boolean) {
    this.tabs = this.tabs.map((t) => (t.id === id ? { ...t, dirty } : t));
    this.emit();
  }
}
