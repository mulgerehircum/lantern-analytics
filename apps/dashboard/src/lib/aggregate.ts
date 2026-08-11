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
   * Only string metadata values become dimensions.
   */
  eventDimensions: Record<string, Record<string, Record<string, number>>>;
}

function increment(map: Record<string, number>, key: string): void {
  if (!key) return;
  map[key] = (map[key] ?? 0) + 1;
}

// Uniques are a count of pageviews flagged isNewVisit (see
// packages/tracker/src/visit.ts and packages/ingestion/src/aggregate.ts's
// doc comment) — not distinct visitorHash. Summing this count across any
// range of rollups is exact, unlike the old Set-per-hour value.
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
