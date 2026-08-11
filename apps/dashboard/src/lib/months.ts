/**
 * Pure "YYYY-MM" month-string helpers — no Date-object leakage into callers,
 * since that's exactly the shape used in AGG# rollup SKs and `?month=` query
 * params throughout the dashboard.
 */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function currentMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/** shiftMonth("2026-01", -1) === "2025-12"; shiftMonth("2026-08", 1) === "2026-09" */
export function shiftMonth(month: string, delta: number): string {
  const [year, monthNum] = month.split("-").map(Number);
  const zeroBased = (year * 12 + (monthNum - 1)) + delta;
  const newYear = Math.floor(zeroBased / 12);
  const newMonth = ((zeroBased % 12) + 12) % 12;
  return `${newYear}-${String(newMonth + 1).padStart(2, "0")}`;
}

/** formatMonthLabel("2026-08") === "August 2026" */
export function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  return `${MONTH_NAMES[monthNum - 1]} ${year}`;
}
