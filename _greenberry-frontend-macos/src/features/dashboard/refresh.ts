// Per-dashboard auto-refresh (S7.5). Interval clamped to a 1-minute minimum.
export const MIN_REFRESH_MS = 60_000;

export function clampInterval(ms: number): number {
  return Math.max(MIN_REFRESH_MS, Math.floor(ms));
}

export class RefreshScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private fn: () => void) {}

  start(ms: number) {
    this.stop();
    this.timer = setInterval(this.fn, clampInterval(ms));
  }
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  get running(): boolean {
    return this.timer !== null;
  }
}
