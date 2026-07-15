// Query variables `{{name}}` — Arctype's signature (S5.6).
const VAR = /\{\{\s*([a-zA-Z_]\w*)\s*\}\}/g;

export function extractVariables(sql: string): string[] {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  VAR.lastIndex = 0;
  while ((m = VAR.exec(sql)) !== null) set.add(m[1]);
  return [...set];
}

export function substituteVariables(
  sql: string,
  values: Record<string, string>,
): string {
  return sql.replace(VAR, (_, name: string) =>
    name in values ? values[name] : `{{${name}}}`,
  );
}
