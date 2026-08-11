import { getReferrerHostname } from "./referrer";

/**
 * True only when this pageview looks like the start of a brand-new visit —
 * the same rough heuristic Simple Analytics documents publicly, chosen
 * specifically so "uniques" doesn't need any IP/UA hashing at all: two
 * signals every browser already exposes for free, no storage, no
 * fingerprinting.
 *
 * - The browser's own navigation-timing type must be a fresh navigation, not
 *   a reload or back/forward-cache restore. Reload loops (a page left open
 *   and refreshed repeatedly — the exact shape of the bot traffic that
 *   motivated this) would otherwise each look like a "new" visitor.
 * - The referrer must be either empty (direct) or a different hostname
 *   (external). A referrer matching this site's own hostname means the
 *   visitor navigated here from another page on the same site — continuing
 *   an existing visit, not starting a new one.
 *
 * Only ever evaluated for the true initial page load (see index.ts) — SPA
 * route changes always pass `false` explicitly, matching the same
 * "subsequent pages only add to pageviews, not visitors" rule.
 */
export function isNewVisit(): boolean {
  const entries = performance.getEntriesByType?.("navigation") as PerformanceNavigationTiming[] | undefined;
  const navType = entries?.[0]?.type;
  if (navType === "reload" || navType === "back_forward") return false;

  return getReferrerHostname() !== location.hostname;
}
