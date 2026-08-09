import { aggregateEvents } from "./aggregate";
import type { HourlyRollupItem, RawEventRecord } from "./dynamodb";

/**
 * Dashboard dimension filters (path / referrer / country / device / custom events).
 *
 * These CANNOT be applied to the AGG# rollups: a rollup stores per-hour
 * counts *within* each dimension (topPages, referrers, ...) but no
 * cross-dimension counts, so e.g. "pageviews to /pricing" can't be derived
 * from them. The filtered view therefore recomputes hourly rollups from raw
 * events — which means it only covers the trailing ~30 days, the raw-event
 * TTL window. Documented here because that coverage limit is a real behavior,
 * not an accident.
 *
 * Custom-event filters (eventName / eventKey / eventValue) follow the same
 * rule. An eventName filter only ever matches custom events (pageviews carry
 * no `name`), so the resulting rollups have pageviews of 0 and the "Pageviews"
 * stat / time-series chart read 0 — a documented consequence, not a bug.
 */

export interface DashboardFilters {
  /** Substring match on path (case-sensitive). */
  path?: string;
  /** Exact match. Pageviews without a referrer are "direct" — see aggregate.ts. */
  referrer?: string;
  /** Exact match, uppercase ISO code as stored (e.g. "MD"). */
  country?: string;
  /** Exact match ("desktop" | "mobile" | "tablet"). */
  device?: string;
  /** Exact match on a custom event name, e.g. "contact_click". Pageviews have
   * no `name`, so they never match — an event-name filter is a custom-events
   * view by construction. */
  eventName?: string;
  /** Exact match on event.metadata[key] === value. Only applied when BOTH
   * eventKey and eventValue are set — a bare key would be ambiguous. */
  eventKey?: string;
  eventValue?: string;
}

/** Raw event plus its DynamoDB key — the hour is embedded in the SK timestamp. */
export interface FilterableEvent extends RawEventRecord {
  SK: string; // "EVENT#2026-08-08T14:32:10Z#f8e2c1"
}

/** Reads filters out of Next.js searchParams; empty/whitespace values become undefined. */
export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): DashboardFilters {
  const pick = (key: string): string | undefined => {
    const value = params[key];
    const raw = Array.isArray(value) ? value[0] : value;
    const trimmed = raw?.trim();
    return trimmed || undefined;
  };
  return {
    path: pick("path"),
    referrer: pick("referrer"),
    country: pick("country"),
    device: pick("device"),
    eventName: pick("eventName"),
    eventKey: pick("eventKey"),
    eventValue: pick("eventValue"),
  };
}

export function hasActiveFilter(filters: DashboardFilters): boolean {
  return Boolean(
    filters.path ||
      filters.referrer ||
      filters.country ||
      filters.device ||
      filters.eventName ||
      filters.eventKey ||
      filters.eventValue,
  );
}

/** AND semantics across the filters that are set; empty filters match everything. */
export function matchesFilter(event: FilterableEvent, filters: DashboardFilters): boolean {
  if (filters.path && !event.path.includes(filters.path)) return false;
  if (filters.referrer && (event.referrer ?? "") !== filters.referrer) return false;
  if (filters.country && event.country !== filters.country) return false;
  if (filters.device && event.device !== filters.device) return false;
  if (filters.eventName && event.name !== filters.eventName) return false;
  if (filters.eventKey && filters.eventValue !== undefined && event.metadata?.[filters.eventKey] !== filters.eventValue) {
    return false;
  }
  return true;
}

/**
 * Rebuilds hourly rollup items from raw events with the filter applied, in
 * the same SK format the real rollup Lambda writes ("AGG#<date>#<hour>"), so
 * the result drops straight into summarizeRollups(). Events that don't match
 * are excluded before aggregation, keeping uniques/counts consistent with the
 * filter rather than "total minus slice" approximations.
 */
export function buildFilteredRollups(
  events: FilterableEvent[],
  filters: DashboardFilters,
): HourlyRollupItem[] {
  const byHour = new Map<string, RawEventRecord[]>();

  for (const event of events) {
    if (!matchesFilter(event, filters)) continue;
    const hour = event.SK.split("#")[1]?.slice(0, 13);
    if (!hour) continue;
    if (!byHour.has(hour)) byHour.set(hour, []);
    byHour.get(hour)!.push(event);
  }

  const rollups: HourlyRollupItem[] = [];
  for (const [hour, hourEvents] of byHour) {
    const [date, hourPart] = hour.split("T");
    rollups.push({ SK: `AGG#${date}#${hourPart}`, ...aggregateEvents(hourEvents) });
  }
  return rollups;
}
