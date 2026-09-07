/**
 * Pure "YYYY-MM" (and "YYYY-MM-DD") date-string helpers - no Date-object
 * leakage into callers, since that's exactly the shape used in AGG# rollup
 * SKs and the `?month=` query param throughout the dashboard. A day is a
 * more specific value in that same `?month=` slot, not a separate param -
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

/** shiftDay("2026-08-31", 1) === "2026-09-01" - real calendar math, not a naive +1 on the string. */
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

/**
 * An hour is a more specific value inside exactly one day, same reasoning as
 * a day inside one month - it reuses the same `?month=` slot rather than a
 * third param. True for "YYYY-MM-DDTHH" (an hour), false otherwise.
 */
export function isHourPeriod(period: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}$/.test(period);
}

/** parentDay("2026-08-15T14") === "2026-08-15" */
export function parentDay(hour: string): string {
  return hour.slice(0, 10);
}

export function currentHour(now: Date = new Date()): string {
  return now.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
}

/** shiftHour("2026-08-15T23", 1) === "2026-08-16T00" - real UTC hour math, including day/month/year rollover. */
export function shiftHour(hour: string, delta: number): string {
  const d = new Date(`${hour}:00:00.000Z`);
  d.setUTCHours(d.getUTCHours() + delta);
  return d.toISOString().slice(0, 13);
}

/**
 * UTC-labeled fallback text, e.g. for SSR before a client component swaps in
 * the viewer's own local time (see HourNav/HourBar) - deliberately says
 * "UTC" so it's never mistaken for local time if JS is slow to hydrate.
 * formatHourLabel("2026-08-15T14") === "August 15, 2026, 14:00 UTC"
 */
export function formatHourLabel(hour: string): string {
  const [day, hourNum] = hour.split("T");
  return `${formatDayLabel(day)}, ${hourNum}:00 UTC`;
}

/**
 * Human label for the same-span baseline, e.g. "August 1-7" when viewing
 * in-progress "2026-09" on Sep 7, or "Sep 6, 0:00-13:00" when viewing the
 * current day at 14:00. null for complete periods and hours (they use the
 * plain "previous period" wording).
 */
export function sameSpanLabel(period: string, isDay: boolean, isHour: boolean, now: Date = new Date()): string | null {
  if (isHour || !isPeriodInProgress(period, isDay, isHour, now)) return null;
  if (isDay) {
    const elapsedHours = now.getUTCHours();
    return `${formatDayLabel(shiftDay(period, -1))}, 0:00-${elapsedHours}:00 UTC`;
  }
  const elapsedDays = now.getUTCDate();
  const [year, monthNum] = shiftMonth(period, -1).split("-").map(Number);
  return `${MONTH_NAMES[monthNum - 1]} 1-${elapsedDays}, ${year}`;
}

/**
 * True when `period` is still in progress at `now` - the current month
 * (any day), the current day (any hour), or the current hour (any minute).
 * A period in progress has no final totals yet, so comparisons against
 * its previous period must truncate the previous one to the same elapsed
 * progress (see rollupWithinElapsedSpan below and its page.tsx call site).
 */
export function isPeriodInProgress(period: string, isDay: boolean, isHour: boolean, now: Date = new Date()): boolean {
  if (isHour) return period === currentHour(now);
  if (isDay) return period === currentDay(now);
  return period === currentMonth(now);
}

/**
 * True when a rollup hour (from the PREVIOUS period's rollups) belongs to
 * the same elapsed span as an in-progress viewed period - the same-span
 * baseline. Drops the "future" tail: viewing month 2026-09 on Sep 7, the
 * previous month's Aug 8-31 rollups must not count toward the baseline
 * (Sep 1-7 compares against Aug 1-7 only); viewing the current day at
 * 14:00, the previous day's hours 15-23 don't count either. Complete
 * periods and hour views keep everything (full-vs-full; hourly rollups
 * have no sub-hour resolution to truncate to).
 */
export function rollupWithinElapsedSpan(
  sk: string,
  viewedPeriod: string,
  isDay: boolean,
  isHour: boolean,
  now: Date = new Date(),
): boolean {
  if (isHour || !isPeriodInProgress(viewedPeriod, isDay, isHour, now)) return true;
  // SK shape: "AGG#2026-08-15#14" -> [_, "2026-08-15", "14"].
  const parts = sk.split("#");
  const dayPart = parts[1] ?? "";
  const hourPart = parts[2] ?? "";
  if (!isDay) {
    // Month view: keep the previous month's days up to the current
    // month's elapsed day number.
    const elapsedDays = now.getUTCDate();
    return Number(dayPart.slice(8, 10)) <= elapsedDays;
  }
  // Day view: keep the previous day's hours up to the current day's
  // elapsed hour number (the current hour counts as elapsed - the live
  // pseudo-rollup for it is already included in the current side).
  const elapsedHours = now.getUTCHours();
  return Number(hourPart) <= elapsedHours;
}
