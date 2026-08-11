/**
 * Site registry for the rollup Lambda — see rollup-handler.ts's doc comment
 * for why an env-var-as-registry is a deliberate Phase 1 simplification
 * rather than a real DynamoDB-backed site table.
 *
 * Must be kept in sync by hand with apps/dashboard/src/lib/sites.ts's SITES
 * array — the two packages don't share code today, so this is a second,
 * separately-committed list rather than an import. A site missing from here
 * never gets its raw events rolled up into a permanent AGG# item; it will
 * only ever show live current-hour data before its raw events expire.
 */
export const SITE_IDS: string[] = [
  "andrii-portfolio",
  "ukraine-warmap",
  "dataroom-technical-assessment",
  "noire-winery-landing-v1",
  "pdfloom-frontend",
  "test-site",
];
