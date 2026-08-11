import type { HourlyRollupItem } from "./dynamodb";

export interface DashboardSummary {
  totalPageviews: number;
  totalUniques: number;
  topPages: Array<{ path: string; count: number }>;
  referrers: Array<{ referrer: string; count: number }>;
  countries: Array<{ country: string; count: number }>;
  devices: Array<{ device: string; count: number }>;
  timeSeries: Array<{ hour: string; pageviews: number }>;
  /** Custom-event totals per event name, e.g. { name: "contact_click", count: 3 }. */
  customEvents: Array<{ name: string; count: number }>;
  /** Flattened per-name, per-dimension rows, e.g. contact_click · platform · email. */
  customEventBreakdown: Array<{ name: string; dimension: string; value: string; count: number }>;
}

function mergeMaps(maps: Record<string, number>[]): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const map of maps) {
    for (const [key, count] of Object.entries(map)) {
      merged[key] = (merged[key] ?? 0) + count;
    }
  }
  return merged;
}

function toSortedEntries<K extends string>(
  map: Record<string, number>,
  keyName: K,
): Array<Record<K, string> & { count: number }> {
  return Object.entries(map)
    .map(([key, count]) => ({ [keyName]: key, count }) as Record<K, string> & { count: number })
    .sort((a, b) => b.count - a.count || a[keyName].localeCompare(b[keyName]));
}

/**
 * Sums per-event-name totals and flattens the nested eventDimensions maps
 * into display rows. Old rollup items written before custom events existed
 * simply lack the fields (treated as empty).
 */
function summarizeCustomEvents(
  rollups: HourlyRollupItem[],
): { customEvents: DashboardSummary["customEvents"]; customEventBreakdown: DashboardSummary["customEventBreakdown"] } {
  const totals: Record<string, number> = {};
  const dimensions: Record<string, Record<string, Record<string, number>>> = {};

  for (const rollup of rollups) {
    for (const [name, count] of Object.entries(rollup.customEvents ?? {})) {
      totals[name] = (totals[name] ?? 0) + count;
    }
    for (const [name, byKey] of Object.entries(rollup.eventDimensions ?? {})) {
      const targetName = (dimensions[name] ??= {});
      for (const [key, byValue] of Object.entries(byKey)) {
        const targetKey = (targetName[key] ??= {});
        for (const [value, count] of Object.entries(byValue)) {
          targetKey[value] = (targetKey[value] ?? 0) + count;
        }
      }
    }
  }

  const customEvents = toSortedEntries(totals, "name");
  const customEventBreakdown: DashboardSummary["customEventBreakdown"] = [];
  for (const [name, byKey] of Object.entries(dimensions)) {
    for (const [dimension, byValue] of Object.entries(byKey)) {
      for (const [value, count] of Object.entries(byValue)) {
        customEventBreakdown.push({ name, dimension, value, count });
      }
    }
  }
  // Count descending; ties broken by key so the order never depends on object
  // insertion order (Array#sort is stable but insertion order varies).
  customEventBreakdown.sort(
    (a, b) =>
      b.count - a.count ||
      a.name.localeCompare(b.name) ||
      a.dimension.localeCompare(b.dimension) ||
      a.value.localeCompare(b.value),
  );

  return { customEvents, customEventBreakdown };
}

/**
 * Note on uniques: each hourly rollup's `uniques` is a count of pageviews
 * flagged `isNewVisit` (packages/tracker/src/visit.ts), decided once per
 * real page load — never per hour. Summing it across any range of rollups
 * is therefore an exact total, unlike the old distinct-visitorHash-per-hour
 * approach this replaced (that one genuinely double-counted a visitor
 * active across an hour boundary, and inflated further across days because
 * visitorHash's salt rotates daily — see dynamodb-schema.md and the repo
 * history around the "uniques from one country" investigation).
 */
export function summarizeRollups(rollups: HourlyRollupItem[]): DashboardSummary {
  const totalPageviews = rollups.reduce((sum, r) => sum + r.pageviews, 0);
  const totalUniques = rollups.reduce((sum, r) => sum + r.uniques, 0);

  const topPages = toSortedEntries(mergeMaps(rollups.map((r) => r.topPages)), "path");
  const referrers = toSortedEntries(mergeMaps(rollups.map((r) => r.referrers)), "referrer");
  const countries = toSortedEntries(mergeMaps(rollups.map((r) => r.countries)), "country");
  const devices = toSortedEntries(mergeMaps(rollups.map((r) => r.devices)), "device");

  // `hour` is a real ISO timestamp (start of that UTC hour), not the raw
  // "2026-08-11#21" rollup-key fragment — the chart needs an actual Date to
  // format in the viewer's own local timezone (see LocalDateTime/HourBar),
  // and "#" was never meant to be user-facing.
  const timeSeries = [...rollups]
    .sort((a, b) => a.SK.localeCompare(b.SK))
    .map((r) => ({ hour: `${r.SK.replace("AGG#", "").replace("#", "T")}:00:00.000Z`, pageviews: r.pageviews }));

  const { customEvents, customEventBreakdown } = summarizeCustomEvents(rollups);

  return {
    totalPageviews,
    totalUniques,
    topPages,
    referrers,
    countries,
    devices,
    timeSeries,
    customEvents,
    customEventBreakdown,
  };
}

export interface MonthlyTrendPoint {
  month: string; // "YYYY-MM"
  pageviews: number;
  uniques: number;
}

export interface DailyTrendPoint {
  day: string; // "YYYY-MM-DD"
  pageviews: number;
  uniques: number;
}

/**
 * Shared grouping logic for both trend functions below: slices each rollup's
 * SK (e.g. "AGG#2026-08-15#14") down to `sliceLength` characters after the
 * "AGG#" prefix — 7 for a month ("2026-08"), 10 for a day ("2026-08-15") —
 * and sums pageviews/uniques per group. Same cross-hour-uniques
 * approximation caveat as summarizeRollups above — this sums already-
 * approximate per-hour unique counts, not a true distinct count.
 */
function groupBySkPrefix(rollups: HourlyRollupItem[], sliceLength: number): Map<string, { pageviews: number; uniques: number }> {
  const grouped = new Map<string, { pageviews: number; uniques: number }>();
  for (const rollup of rollups) {
    const key = rollup.SK.replace("AGG#", "").slice(0, sliceLength);
    const entry = grouped.get(key) ?? { pageviews: 0, uniques: 0 };
    entry.pageviews += rollup.pageviews;
    entry.uniques += rollup.uniques;
    grouped.set(key, entry);
  }
  return grouped;
}

/** Groups hourly rollups by month and sums pageviews/uniques per month. */
export function summarizeMonthlyTrend(rollups: HourlyRollupItem[]): MonthlyTrendPoint[] {
  return [...groupBySkPrefix(rollups, 7).entries()]
    .map(([month, totals]) => ({ month, ...totals }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** Groups hourly rollups by day and sums pageviews/uniques per day. */
export function summarizeDailyTrend(rollups: HourlyRollupItem[]): DailyTrendPoint[] {
  return [...groupBySkPrefix(rollups, 10).entries()]
    .map(([day, totals]) => ({ day, ...totals }))
    .sort((a, b) => a.day.localeCompare(b.day));
}
