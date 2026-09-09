import type { RawEventRecordWithKey } from "./dynamodb";
import type { DashboardFilters } from "./filter";
import { matchesFilter } from "./filter";
import { getEventSemantics } from "./event-semantics";
import { parseEventTimestamp } from "./session-correlation";
import { HEATMAP_CLICK_EVENT_NAME } from "@lantern/shared";

/**
 * Event-centric breakdown for the eventName / eventKey+eventValue filtered
 * view. An event filter matches only custom events by construction
 * (pageviews carry no `name`), so the pageview-centric Overview layout
 * renders a wall of honest-but-useless zeros there - this builds what the
 * filtered view SHOULD show instead: who (countries/devices), where
 * (paths), what else (metadata), and when (daily counts), all derived
 * from the same raw EVENT# items the filter itself reads (~30-day TTL
 * window, same as lib/filter.ts).
 */

export interface EventViewBreakdownRow {
  key: string;
  count: number;
}

export interface EventView {
  /** Total occurrences of the filtered event. */
  count: number;
  /** Distinct visitorHashes among those occurrences - real unique actors, not isNewVisit flags. */
  uniqueVisitors: number;
  /** Daily occurrence counts across the covered window, ascending by day. */
  daily: Array<{ day: string; count: number }>;
  countries: EventViewBreakdownRow[];
  devices: EventViewBreakdownRow[];
  paths: EventViewBreakdownRow[];
  /** Metadata dimension rows: `${key}: ${value}` -> count, top 10. */
  metadata: EventViewBreakdownRow[];
}

function toSortedRows(map: Record<string, number>): EventViewBreakdownRow[] {
  return Object.entries(map)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function buildEventView(events: RawEventRecordWithKey[], filters: DashboardFilters): EventView {
  const matched = events.filter((e) => e.name && matchesFilter(e, filters));
  const visitors = new Set<string>();
  const countries: Record<string, number> = {};
  const devices: Record<string, number> = {};
  const paths: Record<string, number> = {};
  const metadata: Record<string, number> = {};
  const byDay = new Map<string, number>();

  for (const event of matched) {
    visitors.add(event.visitorHash);
    if (event.country) countries[event.country] = (countries[event.country] ?? 0) + 1;
    if (event.device) devices[event.device] = (devices[event.device] ?? 0) + 1;
    if (event.path) paths[event.path] = (paths[event.path] ?? 0) + 1;
    // The SK embeds the send timestamp: "EVENT#2026-08-08T14:32:10Z#f8e2c1".
    const ts = event.SK.split("#")[1];
    const day = ts?.slice(0, 10);
    if (day) byDay.set(day, (byDay.get(day) ?? 0) + 1);
    for (const [key, value] of Object.entries(event.metadata ?? {})) {
      if (typeof value !== "string") continue;
      const rowKey = `${key}: ${value}`;
      metadata[rowKey] = (metadata[rowKey] ?? 0) + 1;
    }
  }

  return {
    count: matched.length,
    uniqueVisitors: visitors.size,
    daily: [...byDay.entries()].map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day)),
    countries: toSortedRows(countries),
    devices: toSortedRows(devices),
    paths: toSortedRows(paths),
    metadata: toSortedRows(metadata).slice(0, 10),
  };
}

/**
 * True for impression-kind events - passive exposure, not visitor action.
 * section_view fires when a section scrolls into view (scroll-past), and
 * card_variant_view on every card render (A/B experiment exposure). Both
 * measure exposure, not intent - excluded from the Latest events feed,
 * which exists to show meaningful visitor actions (clicks, downloads,
 * filters, hovers). Unknown names (no registry entry) are kept - their
 * semantics can't be assumed.
 */
export function isPassiveImpressionEvent(name: string): boolean {
  const kind = getEventSemantics(name)?.kind;
  return kind === "impression" || kind === "experiment-impression";
}

export interface LatestEventRow {
  timestampIso: string;
  name: string;
  metadata?: Record<string, string | number | boolean>;
  country?: string;
  device?: string;
  /** undefined = no matching session recording. */
  sessionHref?: string;
}

/**
 * The Overview's "Latest events" feed: individual custom-event firings -
 * meaningful visitor ACTIONS only (clicks, downloads, filter/hover
 * interactions), with passive impressions (section_view scroll-pasts,
 * card_variant_view experiment exposure) and heatmap click pings
 * excluded via isPassiveImpressionEvent. ~30-day coverage, same as every
 * raw-event read.
 *
 * Per-visitor diversification: a plain newest-first slice is one active
 * visitor's burst (section_view fires repeatedly seconds apart as
 * someone scrolls - observed on live data, 10/10 rows from one session).
 * The feed instead picks round-robin by visitor - one event per visitor
 * per pass, each visitor's newest first, visitors ordered by their
 * newest event - capped at ceil(limit / distinctVisitors) events per
 * visitor so no single visitor can dominate even after quieter visitors
 * run out. Display order is the pick order (NOT re-sorted by time): the
 * first row is the globally newest event, followed by each other
 * visitor's newest, interleaving visitors rather than grouping one
 * person's burst at the top. Pure selector: session correlation stays
 * with the caller, which has the sessions list.
 */
export function selectLatestEvents(events: RawEventRecordWithKey[], limit: number): {
  rows: Array<RawEventRecordWithKey & { timestampMs: number }>;
  total: number;
} {
  const eligible = events.filter(
    (e) => e.name && e.name !== HEATMAP_CLICK_EVENT_NAME && !isPassiveImpressionEvent(e.name),
  );
  const withTime = eligible
    .map((e) => {
      const ms = parseEventTimestamp(e.SK);
      return ms === null ? null : { ...e, timestampMs: ms };
    })
    .filter((e): e is RawEventRecordWithKey & { timestampMs: number } => e !== null);
  withTime.sort((a, b) => b.timestampMs - a.timestampMs);

  // Group newest-first per visitor, preserving each visitor's own recency
  // order; visitor order = recency of each visitor's newest event.
  const byVisitor = new Map<string, Array<RawEventRecordWithKey & { timestampMs: number }>>();
  for (const event of withTime) {
    const list = byVisitor.get(event.visitorHash);
    if (list) list.push(event);
    else byVisitor.set(event.visitorHash, [event]);
  }
  const queues = [...byVisitor.values()];
  if (queues.length === 0) return { rows: [], total: 0 };

  const perVisitorCap = Math.ceil(limit / queues.length);
  const picked: Array<RawEventRecordWithKey & { timestampMs: number }> = [];
  for (let pass = 0; pass < perVisitorCap && picked.length < limit; pass += 1) {
    for (const queue of queues) {
      if (picked.length >= limit) break;
      const event = queue[pass];
      if (event) picked.push(event);
    }
  }
  return { rows: picked, total: withTime.length };
}
