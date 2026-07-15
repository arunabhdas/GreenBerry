// FK click-through with a back stack (S4.8). Uses catalog FK metadata to jump
// to the referenced row and remembers where we came from.
import type { ColumnRef, Engine } from "../../lib/db";
import { buildSelect } from "./sqlBuilder";

export interface FkFrame {
  label: string;
  tabState: unknown;
}

export class FkStack {
  private frames: FkFrame[] = [];

  push(frame: FkFrame) {
    this.frames.push(frame);
  }
  pop(): FkFrame | undefined {
    return this.frames.pop();
  }
  canGoBack(): boolean {
    return this.frames.length > 0;
  }
  depth(): number {
    return this.frames.length;
  }
  clear() {
    this.frames = [];
  }
}

export function buildFkQuery(
  engine: Engine,
  ref: ColumnRef,
  value: unknown,
): string {
  return buildSelect(
    engine,
    { schema: ref.schema, name: ref.table },
    [{ column: ref.column, op: "=", value: String(value) }],
    [],
    { limit: 100, offset: 0 },
  );
}
