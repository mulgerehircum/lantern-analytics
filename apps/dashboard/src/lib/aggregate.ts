/**
 * Mirrors packages/ingestion/src/aggregate.ts exactly. Duplicated rather
 * than imported cross-workspace because this app deploys to Vercel as an
 * isolated project (its own `npm install`, no monorepo root context), which
 * can't resolve a workspace-only sibling package without deeper Vercel
 * monorepo build configuration. A small, stable, already-tested pure
 * function was judged not worth that extra deployment complexity — kept in
 * sync manually if the source ever changes.
 */

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
