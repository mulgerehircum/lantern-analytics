# @lantern/dashboard

Next.js app, deployed on Vercel (Hobby tier). Reads DynamoDB via scoped IAM keys.

Phase 1: pageviews over time, top pages, referrers, countries, devices.
Phase 2: session list + replay (rrweb-player), reading recordings from the
Mac-mini-hosted storage via Cloudflare Tunnel.
Phase 3: natural-language query interface over aggregate stats + session summaries.

Not scaffolded with `create-next-app` yet — structure only.

## Feature flags

`src/lib/flags.ts` — server-only, read from env vars (never `NEXT_PUBLIC_`,
since every consumer is a Server Component).

- `FUNNELS_ENABLED` (`/funnels`, `lib/funnel.ts`): off by default. The first
  real-data pass showed most cross-event joins returning 0 visitors —
  `visitorHash` rotates daily (see `dynamodb.ts`), and at this site's traffic
  volume a click and the impression that led to it often land on different
  calendar days, so the join silently fails. The funnel math itself is
  correct (verified against same-day, same-visitor data); the feature just
  isn't trustworthy enough to show by default until that's addressed —
  candidates: a longer-lived visitor identity, or a documented "same day
  only" caveat in the UI. Set `FUNNELS_ENABLED=true` to turn it back on for
  testing.
- `HEATMAPS_ENABLED` (`/heatmaps`, `lib/heatmap.ts`, `components/HeatmapOverlay.tsx`):
  off by default for a different reason than Funnels — its live-iframe-overlay
  rendering (dots positioned on top of a real `<iframe>` of the tracked page)
  can only be verified end-to-end in production, after all of:
  1. This dashboard is deployed with the tracker changes below.
  2. The tracked site's own `<script>` tag adds `data-heatmap` — **a separate
     repo** (`andrii-portfolio`), not this one. Example:
     `<script src="https://dashboard-rho-one-10.vercel.app/tracker.js" data-site-id="andrii-portfolio" data-endpoint="..." data-heatmap ...>`.
  3. Real clicks accumulate (`lantern_heatmap_click`, ~30-day raw-event
     window, same TTL as everything else raw-event-driven here).

  Locally this was only verified with synthetic points (both the live-overlay
  and the grid-only fallback render correctly) — set `HEATMAPS_ENABLED=true`
  to turn it on once the above is in place.

  The tracker itself ships regardless of this flag (`packages/tracker/src/heatmap.ts`,
  `frame-report.ts`) — `HEATMAPS_ENABLED` only gates the dashboard's own
  `/heatmaps` page and nav link; per-site data collection is separately
  opt-in via that site's own `data-heatmap` attribute. Run
  `npm run build:release` in `packages/tracker` (builds + copies
  `dist/tracker.js`/`tracker-recorder.js` into `apps/dashboard/public/`,
  which this app serves directly) after any tracker change, and commit the
  synced `public/tracker.js` alongside the source — the next deploy ships it
  automatically, no separate publish step.
