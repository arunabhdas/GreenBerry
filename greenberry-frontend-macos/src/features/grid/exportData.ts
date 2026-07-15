// Import/export (S4.9). CSV + JSON serialization and a small RFC-4180 CSV parser
// (for CSV import with column mapping / Workspace DB).
export function toCsv(columns: string[], rows: unknown[][]): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [columns.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join(
    "\n",
  );
}

export function toJson(columns: string[], rows: unknown[][]): string {
  return JSON.stringify(
    rows.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]]))),
    null,
    2,
  );
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    records.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      endField();
    } else if (c === "\n") {
      endRow();
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) endRow();

  const headers = records.shift() ?? [];
  return { headers, rows: records };
}

/** Map imported CSV rows to a target column order (for column mapping). */
export function mapColumns(
  parsed: { headers: string[]; rows: string[][] },
  mapping: Record<string, string>, // target -> source header
  targetColumns: string[],
): Record<string, string>[] {
  const idx = (h: string) => parsed.headers.indexOf(h);
  return parsed.rows.map((r) => {
    const obj: Record<string, string> = {};
    for (const target of targetColumns) {
      const source = mapping[target];
      const i = source ? idx(source) : -1;
      obj[target] = i >= 0 ? (r[i] ?? "") : "";
    }
    return obj;
  });
}
