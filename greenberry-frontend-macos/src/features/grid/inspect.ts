// Cell value formatting + JSON handling for the cell inspector (S4.6).
export function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function isJsonLike(v: unknown): boolean {
  if (v !== null && typeof v === "object") return true;
  if (typeof v === "string") {
    const s = v.trim();
    return (s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"));
  }
  return false;
}

export function tryParseJson(v: unknown): unknown | undefined {
  if (v !== null && typeof v === "object") return v;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function prettyJson(v: unknown): string {
  const parsed = tryParseJson(v);
  return JSON.stringify(parsed ?? v, null, 2);
}
