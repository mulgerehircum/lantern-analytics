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
