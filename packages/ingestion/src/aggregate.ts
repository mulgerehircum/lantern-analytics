export interface RawEventItem {
  path: string;
  /** Pageview only — absent on custom events. */
  referrer?: string;
  country: string;
  device: string;
  visitorHash: string;
  /** Pageview only — see packages/tracker/src/visit.ts. Absent on rollups
   * written before this field existed; treated as `false`. */
  isNewVisit?: boolean;
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
 *
 * Uniques are a count of pageviews flagged `isNewVisit` (see
 * packages/tracker/src/visit.ts) — NOT distinct `visitorHash`. That switch
 * (see repo history around the "uniques from one country" investigation)
 * fixes two real problems the hash-based Set approach had: (1) `visitorHash`
 * rotates its salt daily, so summing per-hour Sets across days systematically
 * overcounts the same real visitor as several; (2) a Set only dedupes an
 * *identity*, it says nothing about whether the traffic looked like genuine
 * new visits — a bot reloading the same URL in a loop still has one stable
 * `visitorHash` per day, but every reload set `isNewVisit: false`, so it
 * correctly contributes 0 uniques instead of 1. Because `isNewVisit` is
 * decided once per real page load (never per hour), summing this count
 * across any range of rollups is an exact total, not the approximation the
 * old Set-per-hour value was.
 *
 * An empty referrer is bucketed as "direct" (a blank referrer means the
 * visit didn't come via a link, not that the data is missing). Custom
 * events are tallied into `customEvents`/`eventDimensions` and deliberately
 * never touch the pageview/uniques totals.
 */
export function aggregateEvents(events: RawEventItem[]): HourlyRollup {
  const topPages: Record<string, number> = {};
  const referrers: Record<string, number> = {};
  const countries: Record<string, number> = {};
  const devices: Record<string, number> = {};
  const customEvents: Record<string, number> = {};
  const eventDimensions: Record<string, Record<string, Record<string, number>>> = {};
  let uniques = 0;

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
    if (event.isNewVisit) uniques += 1;
  }

  return {
    pageviews: events.filter((e) => !e.name).length,
    uniques,
    topPages,
    referrers,
    countries,
    devices,
    customEvents,
    eventDimensions,
  };
}
