# Lantern Analytics (working name)

Privacy-first web analytics — a PostHog/Simple Analytics/Vercel Analytics alternative,
built to be **AI-native rather than dashboard-first**: ask questions about your traffic
and recorded sessions in plain English instead of hunting through charts.

## Why this project exists

Built to close three specific skill gaps identified from evaluated job reports
(AWS, Next.js, LLM integration — see career-ops's `upskill.mjs`), using infrastructure
that stays free at portfolio-demo scale. Not a Sirius/employer project — standalone,
no domain overlap with any current or prior work.

## Architecture

| Piece | Choice | Why |
|---|---|---|
| Tracking script | Vanilla JS, cookieless, DNT-respecting, hashed IPs for uniques | No cookie consent banner needed, genuinely privacy-first |
| Ingestion | AWS Lambda + API Gateway (HTTP API) | Real AWS experience; Lambda is always-free, API Gateway free for 12mo then ~$1/million calls |
| Analytics storage | DynamoDB | Always-free tier (25GB + 25 WCU/RCU), fits time-series/aggregate access patterns |
| Session recording capture | [rrweb](https://github.com/rrweb-io/rrweb) | Don't reinvent DOM diff/replay — integrate the library PostHog/LogRocket use under the hood |
| Session recording storage | Self-hosted (Mac mini) via Cloudflare Tunnel, Postgres or flat files | Recordings are large blobs (100KB-several MB) — DynamoDB has a 400KB/item limit anyway; self-hosting the heaviest storage is the best place to use free existing hardware without losing the AWS story on the more interesting pieces (Lambda, DynamoDB) |
| Dashboard | Next.js on Vercel (Hobby tier) | Free, zero-friction Next.js hosting; reads DynamoDB via scoped IAM keys |
| AI layer (Phase 3) | LLM over aggregate stats + recorded session events | The actual differentiator — every competitor here is dashboard-first |

**Privacy note:** since the pitch leans on privacy-first positioning, session recording
input masking must be on by default (passwords/sensitive fields never captured), same
as PostHog's default behavior. This is a requirement, not a nice-to-have — the whole
value prop breaks if the "privacy-first" claim doesn't hold up on the riskiest feature.

## Repo layout

```
lantern-analytics/
├── packages/
│   ├── tracker/     — client-side tracking script (pageviews + rrweb session capture)
│   ├── ingestion/   — AWS Lambda handlers + infra-as-code (API Gateway, DynamoDB)
│   └── shared/      — event schema/types shared across tracker, ingestion, dashboard
├── apps/
│   └── dashboard/   — Next.js app (charts, session replay, AI query interface)
└── docs/            — architecture notes, decisions
```

## Phased plan

### Phase 1 (Weeks 1-2) — Core dashboard MVP
- Tracking script: pageview beacon, cookieless, hashed IPs
- Lambda ingestion endpoint (API Gateway HTTP API)
- DynamoDB schema for pageview/event aggregates (time-bucketed)
- Next.js dashboard: pageviews over time, top pages, referrers, countries, devices
- Dogfood on the project's own demo/portfolio site

### Phase 2 (Weeks 3-4) — Session recording
- rrweb capture wired into the tracking script, input masking on by default
- Batched upload to the Mac mini (via Cloudflare Tunnel — no exposed ports)
- Session list + replay UI (rrweb-player) in the dashboard

### Phase 3 (Weeks 5+) — AI layer
- Session-summary AI: reasons over recorded session events ("rage-clicked here,
  abandoned checkout") — the sharper, more concrete AI story
- Natural-language query interface over aggregate analytics data

## Status

Phase 1 (tracking script, ingestion, dashboard MVP) and Phase 2 (session
recording) are implemented. Phase 3 (AI query interface) is in progress.
