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
}

export const SITES: SiteInfo[] = [
  { siteId: "andrii-portfolio", name: "Portfolio (folio-v1)", url: "https://andriiponomarenko.vercel.app" },
  { siteId: "ukraine-warmap", name: "Ukraine Warmap", url: "https://ukraine-warmap.vercel.app" },
  { siteId: "dataroom-technical-assessment", name: "Dataroom (technical assessment)", url: "https://dataroom-technical-assessment.vercel.app" },
  { siteId: "noire-winery-landing", name: "Noire Winery Landing", url: "https://noire-winery-landing.vercel.app" },
  { siteId: "noire-winery-landing-v1", name: "Noire Winery Landing v1", url: "https://noire-winery-landing-v1.vercel.app" },
  // pdfloom (the backend) is a pure API with no pages — nothing to track;
  // only its frontend project is registered.
  { siteId: "pdfloom-frontend", name: "PDFloom Inventory Manager", url: "https://inventory-manager-frontend-gilt.vercel.app" },
  { siteId: "test-site", name: "Test site" },
];

/** The site the dashboard defaults to when no ?siteId= is given. */
export const DEFAULT_SITE_ID = "andrii-portfolio";

export function getSite(siteId: string): SiteInfo | undefined {
  return SITES.find((site) => site.siteId === siteId);
}
