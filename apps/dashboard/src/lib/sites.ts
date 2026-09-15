/**
 * Registry of sites the dashboard can display. Static on purpose: this
 * project deliberately avoids a GSI for cross-site queries (see
 * packages/ingestion/docs/dynamodb-schema.md), so the project list is a
 * checked-in map rather than a DynamoDB scan. Adding a site = one line here
 * plus installing the tracker on the site itself.
 *
 * siteId values match the `data-site-id` attribute the tracker is loaded with
 * (which in turn becomes the SITE# partition key), not the Vercel project
 * name. `andrii-portfolio` predates the naming convention; the rest use the
 * Vercel project name as-is.
 */

export interface SiteInfo {
  siteId: string;
  name: string;
  /** Production URL shown in the selector; undefined for non-public sites. */
  url?: string;
  /**
   * Opt-in: expose aggregate, all-time stats publicly at /public/<siteId>.
   * Off by default - the dashboard has no auth, so every page is technically
   * reachable, but this flag is the explicit "I'm okay showing this site's
   * numbers to anyone with the URL" decision. Only aggregate referrer counts
   * and pageview/unique totals are ever shown on that page - never paths,
   * countries, devices, or session data.
   */
  publicStats?: boolean;
}

export const SITES: SiteInfo[] = [
  { siteId: "andrii-portfolio", name: "Portfolio (folio-v1)", url: "https://andriiponomarenko.vercel.app", publicStats: true },
  { siteId: "ukraine-warmap", name: "Ukraine Warmap", url: "https://ukraine-warmap.vercel.app" },
  { siteId: "dataroom-technical-assessment", name: "Dataroom (technical assessment)", url: "https://dataroom-technical-assessment.vercel.app" },
  { siteId: "noire-winery-landing-v1", name: "Noire Winery Landing v1", url: "https://noire-winery-landing-v1.vercel.app" },
  // pdfloom (the backend) is a pure API with no pages - nothing to track;
  // only its frontend project is registered. noire-winery-landing (non-v1) is
  // excluded: its GitHub repo is archived and its Vercel deployment is
  // password-protected, so it can't run the tracker.
  { siteId: "pdfloom-frontend", name: "PDFloom Inventory Manager", url: "https://inventory-manager-frontend-gilt.vercel.app" },
  // The dashboard dogfooding itself: tracker.js served from this app's own
  // public/ dir (same origin, no extra request), siteId "lantern-dashboard".
  // NO publicStats - the private dashboard's own traffic stats (including
  // which referrers send visitors here) stay behind the normal dashboard
  // views, not on a shareable page.
  { siteId: "lantern-dashboard", name: "Lantern Dashboard (dogfood)", url: "https://dashboard-rho-one-10.vercel.app" },
  { siteId: "test-site", name: "Test site" },
];

/** The site the dashboard defaults to when no ?siteId= is given. */
export const DEFAULT_SITE_ID = "andrii-portfolio";

export function getSite(siteId: string): SiteInfo | undefined {
  return SITES.find((site) => site.siteId === siteId);
}

/**
 * The /public/<siteId> gate: same lookup as getSite but filtered on the
 * explicit publicStats opt-in. Non-opted sites (and unknown ids) are
 * indistinguishable from here on up - the page 404s rather than hinting at
 * what exists, same "404, not a 0" principle as the widget route.
 */
export function getPublicSite(siteId: string): SiteInfo | undefined {
  return SITES.find((site) => site.siteId === siteId && site.publicStats === true);
}
