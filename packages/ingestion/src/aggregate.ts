export interface RawEventItem {
  path: string;
  referrer: string;
  country: string;
  device: string;
  visitorHash: string;
}

export interface HourlyRollup {
  pageviews: number;
  uniques: number;
  topPages: Record<string, number>;
  referrers: Record<string, number>;
  countries: Record<string, number>;
  devices: Record<string, number>;
}

function increment(map: Record<string, number>, key: string): void {
  if (!key) return;
  map[key] = (map[key] ?? 0) + 1;
}

/**
 * Pure aggregation — no AWS calls, so this is cheap to test exhaustively.
 * Uniques are counted by distinct visitorHash within the hour; an empty
 * referrer is bucketed as "direct" (a blank referrer means the visit didn't
 * come via a link, not that the data is missing).
 */
export function aggregateEvents(events: RawEventItem[]): HourlyRollup {
  const topPages: Record<string, number> = {};
  const referrers: Record<string, number> = {};
  const countries: Record<string, number> = {};
  const devices: Record<string, number> = {};
  const uniqueVisitors = new Set<string>();

  for (const event of events) {
    increment(topPages, event.path);
    increment(referrers, event.referrer || "direct");
    increment(countries, event.country);
    increment(devices, event.device);
    if (event.visitorHash) uniqueVisitors.add(event.visitorHash);
  }

  return {
    pageviews: events.length,
    uniques: uniqueVisitors.size,
    topPages,
    referrers,
    countries,
    devices,
  };
}
