/**
 * Pure "YYYY-MM" (and "YYYY-MM-DD") date-string helpers — no Date-object
 * leakage into callers, since that's exactly the shape used in AGG# rollup
 * SKs and the `?month=` query param throughout the dashboard. A day is a
 * more specific value in that same `?month=` slot, not a separate param —
 * a day is always inside exactly one month, so there's nothing a second
 * param would disambiguate.
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

/** True for "YYYY-MM-DD" (a day), false for "YYYY-MM" (a month). */
export function isDayPeriod(period: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(period);
}

/** parentMonth("2026-08-15") === "2026-08" */
export function parentMonth(day: string): string {
  return day.slice(0, 7);
}

export function currentDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** shiftDay("2026-08-31", 1) === "2026-09-01" — real calendar math, not a naive +1 on the string. */
export function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** formatDayLabel("2026-08-15") === "August 15, 2026" */
export function formatDayLabel(day: string): string {
  const [year, monthNum, dayNum] = day.split("-").map(Number);
  return `${MONTH_NAMES[monthNum - 1]} ${dayNum}, ${year}`;
}
