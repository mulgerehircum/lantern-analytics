import type { DashboardFilters } from "./filter";

/**
 * UI-only helpers for the click-to-filter data-table rows - kept separate
 * from lib/filter.ts (which stays untouched: parsing/matching/rollup logic
 * only) so this file can own href-construction and active-row comparison
 * without growing that one's surface area.
 */

export type RowFilterDimension = "path" | "referrer" | "country" | "device" | "eventName";

export const ROW_FILTER_LABELS: Record<RowFilterDimension, string> = {
  path: "Path",
  referrer: "Referrer",
  country: "Country",
  device: "Device",
  eventName: "Event",
};

/**
 * Builds an href that filters on exactly one dimension. Deliberately drops
 * every other query param (month, other filters) - clicking a table row
 * always REPLACES the active filter rather than composing with it, matching
 * the design's "only one filter active at a time" rule.
 */
export function buildRowFilterHref(siteId: string, dim: RowFilterDimension, value: string): string {
  const params = new URLSearchParams({ siteId, [dim]: value });
  return `/?${params.toString()}`;
}

/** For "Custom event details" rows, which filter on the eventKey+eventValue pair together. */
export function buildEventDetailFilterHref(siteId: string, eventName: string, key: string, value: string): string {
  const params = new URLSearchParams({ siteId, eventName, eventKey: key, eventValue: value });
  return `/?${params.toString()}`;
}

/** Server-side "is this row the active filter" check, for row highlighting. */
export function isActiveRowFilter(filters: DashboardFilters, dim: RowFilterDimension, value: string): boolean {
  return filters[dim] === value;
}

export function isActiveEventDetailFilter(filters: DashboardFilters, eventName: string, key: string, value: string): boolean {
  return filters.eventName === eventName && filters.eventKey === key && filters.eventValue === value;
}

/** Builds the header "Filtered by X: Y ✕" chip from whichever single filter dimension is currently set. */
export function buildFilterChip(
  siteId: string,
  filters: DashboardFilters,
): { label: string; value: string; clearHref: string } | undefined {
  const clearHref = `/?siteId=${encodeURIComponent(siteId)}`;
  if (filters.eventKey && filters.eventValue) {
    return { label: `${filters.eventName ?? "Event"} · ${filters.eventKey}`, value: filters.eventValue, clearHref };
  }
  for (const dim of ["path", "referrer", "country", "device", "eventName"] as RowFilterDimension[]) {
    const value = filters[dim];
    if (value) return { label: ROW_FILTER_LABELS[dim], value, clearHref };
  }
  return undefined;
}
