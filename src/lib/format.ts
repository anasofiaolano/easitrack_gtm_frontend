/** Format a date string to locale date */
export function fmtDate(v: unknown): string {
  if (!v) return "";
  return new Date(v as string).toLocaleDateString();
}

/** Format a date string to locale datetime */
export function fmtDateTime(v: unknown): string {
  if (!v) return "";
  return new Date(v as string).toLocaleString();
}

/** Format a boolean to Yes/empty */
export function fmtBool(v: unknown): string {
  return v ? "Yes" : "";
}

/** Format USD */
export function fmtUSD(v: unknown): string {
  if (!v) return "$0";
  return `$${Number(v).toFixed(2)}`;
}

/** Format a JSON value */
export function fmtJSON(v: unknown): string {
  if (!v) return "";
  try {
    const obj = typeof v === "string" ? JSON.parse(v) : v;
    return JSON.stringify(obj);
  } catch {
    return String(v);
  }
}

type Row = Record<string, unknown>;

/** Pre-format rows server-side so no functions need to cross to client */
export function formatRows(
  rows: Row[],
  formatters: Record<string, (v: unknown) => string>
): Record<string, string | number | boolean | null>[] {
  return rows.map((row) => {
    const out: Record<string, string | number | boolean | null> = {};
    for (const key in row) {
      if (formatters[key]) {
        out[key] = formatters[key](row[key]);
      } else {
        out[key] = row[key] as string | number | boolean | null;
      }
    }
    return out;
  });
}
