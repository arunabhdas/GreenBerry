// Split a SQL script into statements, respecting quotes and comments (S5.4).
export interface Statement {
  sql: string;
  start: number;
  end: number;
}

export function splitStatements(script: string): Statement[] {
  const out: Statement[] = [];
  let start = 0;
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let lineComment = false;
  let blockComment = false;

  const push = (end: number) => {
    const text = script.slice(start, end);
    if (text.trim()) out.push({ sql: text.trim(), start, end });
    start = end + 1;
  };

  while (i < script.length) {
    const c = script[i];
    const n = script[i + 1];
    if (lineComment) {
      if (c === "\n") lineComment = false;
      i++;
    } else if (blockComment) {
      if (c === "*" && n === "/") {
        blockComment = false;
        i++;
      }
      i++;
    } else if (inSingle) {
      if (c === "'") {
        if (n === "'") i++;
        else inSingle = false;
      }
      i++;
    } else if (inDouble) {
      if (c === '"') {
        if (n === '"') i++;
        else inDouble = false;
      }
      i++;
    } else if (c === "-" && n === "-") {
      lineComment = true;
      i += 2;
    } else if (c === "/" && n === "*") {
      blockComment = true;
      i += 2;
    } else if (c === "'") {
      inSingle = true;
      i++;
    } else if (c === '"') {
      inDouble = true;
      i++;
    } else if (c === ";") {
      push(i);
      i++;
    } else {
      i++;
    }
  }
  if (start < script.length) push(script.length);
  return out;
}

/** The statement containing a cursor offset (falls back to the last one). */
export function statementAtOffset(
  script: string,
  offset: number,
): Statement | null {
  const stmts = splitStatements(script);
  for (const s of stmts) {
    if (offset >= s.start && offset <= s.end) return s;
  }
  return stmts.length ? stmts[stmts.length - 1] : null;
}
