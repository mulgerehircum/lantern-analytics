# @lantern/dashboard

Next.js app, deployed on Vercel (Hobby tier). Reads DynamoDB via scoped IAM keys.

Phase 1: pageviews over time, top pages, referrers, countries, devices.
Phase 2: session list + replay (rrweb-player), reading recordings from the
Mac-mini-hosted storage via Cloudflare Tunnel.
Phase 3: natural-language query interface over aggregate stats + session summaries.

Not scaffolded with `create-next-app` yet — structure only.
