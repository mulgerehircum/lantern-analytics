/** Minimal RFC 4180 field escaping - quote a field containing a comma, quote, or newline, doubling embedded quotes. */
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Builds a CSV string ("Key,Count" header + one row per entry) from a DataTableCard's rows, in the given order. */
export function buildRowsCsv(rows: readonly { key: string; count: number }[]): string {
  const lines = ["Key,Count", ...rows.map((r) => `${escapeCsvField(r.key)},${r.count}`)];
  return lines.join("\r\n");
}
