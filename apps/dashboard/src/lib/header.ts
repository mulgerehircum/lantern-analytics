import { shiftDay, shiftHour, shiftMonth } from "./months";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09" -> "Sep 1, 2026 - Sep 30, 2026". Hyphen-joined per the header copy rule (never en/em dashes). */
export function formatMonthRangeLabel(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  const start = `${SHORT_MONTHS[monthNum - 1]} 1, ${year}`;
  const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  return `${start} - ${SHORT_MONTHS[monthNum - 1]} ${lastDay}, ${year}`;
}

/** "2026-09-15" -> "Sep 15, 2026" */
export function formatDayRangeLabel(day: string): string {
  const [year, monthNum, dayNum] = day.split("-").map(Number);
  return `${SHORT_MONTHS[monthNum - 1]} ${dayNum}, ${year}`;
}

/** "2026-09-15T14" -> "Sep 15, 2026, 14:00 - 15:00" (rolls over midnight correctly). */
export function formatHourRangeLabel(hour: string): string {
  const [day, hourNum] = hour.split("T");
  const startHour = Number(hourNum);
  const endHour = (startHour + 1) % 24;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatDayRangeLabel(day)}, ${pad(startHour)}:00 - ${pad(endHour)}:00`;
}

/**
 * Header date-range pill text for the current view. All-time has no range -
 * callers render a plain "All time" label with no stepper.
 */
export function formatHeaderRangeLabel(selectedPeriod: string | undefined, isDay: boolean, isHour: boolean): string {
  if (!selectedPeriod) return "All time";
  if (isHour) return formatHourRangeLabel(selectedPeriod);
  if (isDay) return formatDayRangeLabel(selectedPeriod);
  return formatMonthRangeLabel(selectedPeriod);
}

/** Prev/next period at the current drill depth. Null at all-time (no single adjacent period). */
export function prevNextPeriod(
  selectedPeriod: string | undefined,
  isDay: boolean,
  isHour: boolean,
): { prev: string; next: string } | null {
  if (!selectedPeriod) return null;
  if (isHour) return { prev: shiftHour(selectedPeriod, -1), next: shiftHour(selectedPeriod, 1) };
  if (isDay) return { prev: shiftDay(selectedPeriod, -1), next: shiftDay(selectedPeriod, 1) };
  return { prev: shiftMonth(selectedPeriod, -1), next: shiftMonth(selectedPeriod, 1) };
}

export interface OverviewCsvInput {
  periodLabel: string;
  pageviews: number;
  uniques: number;
  topPages: Array<{ path: string; count: number }>;
  referrers: Array<{ referrer: string; count: number }>;
  countries: Array<{ country: string; count: number }>;
}

/** Minimal RFC 4180 field escaping - quote a field containing a comma, quote, or newline, doubling embedded quotes. */
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Whole-view CSV for the header Export action: summary metrics followed by
 * the top breakdown tables. Sections are separated by a blank line; each
 * section keeps the same two-column shape so it opens cleanly in sheets.
 */
export function buildOverviewCsv(input: OverviewCsvInput): string {
  const lines = [
    "Section,Key,Value",
    `Summary,Period,${escapeCsvField(input.periodLabel)}`,
    `Summary,Pageviews,${input.pageviews}`,
    `Summary,Uniques,${input.uniques}`,
    "",
    ...input.topPages.map((p) => `Top pages,${escapeCsvField(p.path || "(empty)")},${p.count}`),
    "",
    ...input.referrers.map((r) => `Referrers,${escapeCsvField(r.referrer || "(empty)")},${r.count}`),
    "",
    ...input.countries.map((c) => `Countries,${escapeCsvField(c.country || "(empty)")},${c.count}`),
  ];
  return lines.join("\r\n");
}
