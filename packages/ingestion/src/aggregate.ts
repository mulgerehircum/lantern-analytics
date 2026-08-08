export interface RawEventItem {
  path: string;
  /** Pageview only — absent on custom events. */
  referrer?: string;
  country: string;
  device: string;
  visitorHash: string;
  /** Present iff this is a custom event (e.g. "contact_click"). */
  name?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface HourlyRollup {
  pageviews: number;
  uniques: number;
  topPages: Record<string, number>;
  referrers: Record<string, number>;
  countries: Record<string, number>;
  devices: Record<string, number>;
  /** Custom-event count by event name, e.g. { "contact_click": 3 }. */
  customEvents: Record<string, number>;
  /**
   * Per-name, per-string-metadata-key dimension counts, e.g.
   * { "project_link_click": { "project_title": { "PDFloom": 2 } } }.
   * Only string metadata values become dimensions — high-cardinality string
   * metadata would bloat rollup items, a documented tradeoff (see
   * docs/dynamodb-schema.md).
   */
  eventDimensions: Record<string, Record<string, Record<string, number>>>;
}

function increment(map: Record<string, number>, key: string): void {
  if (!key) return;
  map[key] = (map[key] ?? 0) + 1;
}

/**
 * Pure aggregation — no AWS calls, so this is cheap to test exhaustively.
 * Uniques are counted by distinct visitorHash within the hour; an empty
 * referrer is bucketed as "direct" (a blank referrer means the visit didn't
 * come via a link, not that the data is missing). Custom events are tallied
 * into `customEvents`/`eventDimensions` and deliberately never touch the
 * pageview/uniques totals.
 */
export function aggregateEvents(events: RawEventItem[]): HourlyRollup {
  const topPages: Record<string, number> = {};
  const referrers: Record<string, number> = {};
  const countries: Record<string, number> = {};
  const devices: Record<string, number> = {};
  const customEvents: Record<string, number> = {};
  const eventDimensions: Record<string, Record<string, Record<string, number>>> = {};
  const uniqueVisitors = new Set<string>();

  for (const event of events) {
    if (event.name) {
      increment(customEvents, event.name);
      const byName = (eventDimensions[event.name] ??= {});
      for (const [key, value] of Object.entries(event.metadata ?? {})) {
        if (typeof value !== "string") continue;
        const byKey = (byName[key] ??= {});
        increment(byKey, value);
      }
      continue;
    }

    increment(topPages, event.path);
    increment(referrers, event.referrer || "direct");
    increment(countries, event.country);
    increment(devices, event.device);
    if (event.visitorHash) uniqueVisitors.add(event.visitorHash);
  }

  return {
    pageviews: events.filter((e) => !e.name).length,
    uniques: uniqueVisitors.size,
    topPages,
    referrers,
    countries,
    devices,
    customEvents,
    eventDimensions,
  };
}
