import type { HourlyRollupItem } from "./dynamodb";

export interface DashboardSummary {
  totalPageviews: number;
  totalUniques: number;
  topPages: Array<{ path: string; count: number }>;
  referrers: Array<{ referrer: string; count: number }>;
  countries: Array<{ country: string; count: number }>;
  devices: Array<{ device: string; count: number }>;
  timeSeries: Array<{ hour: string; pageviews: number }>;
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
    .sort((a, b) => b.count - a.count);
}

/**
 * Note on uniques: summing per-hour `uniques` is an approximation, not an
 * exact distinct-visitor count across the full range — a visitor active in
 * two different hours gets counted twice. Exact cross-hour uniques would
 * need the raw visitorHash set, which rollups deliberately don't retain
 * (see dynamodb-schema.md). Fine for a trend number; documented here so
 * it's a known approximation, not a silent inaccuracy someone finds later.
 */
export function summarizeRollups(rollups: HourlyRollupItem[]): DashboardSummary {
  const totalPageviews = rollups.reduce((sum, r) => sum + r.pageviews, 0);
  const totalUniques = rollups.reduce((sum, r) => sum + r.uniques, 0);

  const topPages = toSortedEntries(mergeMaps(rollups.map((r) => r.topPages)), "path");
  const referrers = toSortedEntries(mergeMaps(rollups.map((r) => r.referrers)), "referrer");
  const countries = toSortedEntries(mergeMaps(rollups.map((r) => r.countries)), "country");
  const devices = toSortedEntries(mergeMaps(rollups.map((r) => r.devices)), "device");

  const timeSeries = [...rollups]
    .sort((a, b) => a.SK.localeCompare(b.SK))
    .map((r) => ({ hour: r.SK.replace("AGG#", ""), pageviews: r.pageviews }));

  return { totalPageviews, totalUniques, topPages, referrers, countries, devices, timeSeries };
}
