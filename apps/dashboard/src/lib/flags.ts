/**
 * Server-only feature flags, read from env vars at request time (not
 * NEXT_PUBLIC_ — every consumer here is a Server Component). Funnels ships
 * behind one: its first real-data pass showed most cross-event joins
 * returning 0, because visitorHash rotates daily (see dynamodb.ts) and this
 * site's traffic is low enough that a click and its preceding impression
 * often land on different days. Off by default until that's addressed. See
 * README.md.
 */
export const FUNNELS_ENABLED = process.env.FUNNELS_ENABLED === "true";

/**
 * Heatmaps ships behind a flag too, for a different reason than Funnels: its
 * live-iframe-overlay rendering can only be verified in production, after
 * (a) this dashboard is deployed with the updated tracker.js, (b) a tracked
 * site's own <script> tag opts in via data-heatmap, and (c) real clicks
 * accumulate. Off by default until that end-to-end path has actually been
 * confirmed working, not just unit-tested.
 */
export const HEATMAPS_ENABLED = process.env.HEATMAPS_ENABLED === "true";
