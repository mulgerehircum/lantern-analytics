# Dashboard — Design

## Phase 1 scope
Read-only views over the DynamoDB rollups (`AGG#` items, see
`packages/ingestion/docs/dynamodb-schema.md`) — never queries raw `EVENT#` items
directly. The dashboard should never need to scan; every view maps to a cheap
`PK + SK begins_with` query.

Views:
- **Traffic over time** — pageviews/uniques per hour or day, from `AGG#<date>#<hour>` items
- **Top pages** — read directly off the `topPages` map already denormalized into
  each rollup item, no separate aggregation query needed
- **Referrers / countries / devices** — same pattern, same rollup item

## Data access
Next.js API routes (server-side only) hold the AWS SDK client and a scoped IAM
user's credentials (read-only on the `lantern-events` table, nothing else). The
credentials never reach the browser — the dashboard's client code talks to its own
`/api/*` routes, which then call DynamoDB server-side. This is the same shape as
`dataroom-technical-assessment`'s `/api` pattern, reused deliberately rather than
inventing a new one.

## Hosting
Vercel (Hobby tier). No reason for this piece to be anywhere else — the AWS story
lives in the ingestion pipeline, not in where the dashboard frontend happens to run.

## Phase 2 addition — session replay
- Session list view, reading `SessionRecordingMeta` (see
  `packages/shared/docs/event-schema.md`) from DynamoDB
- Replay via `rrweb-player`, fetching the actual recording blob from the Mac-mini-hosted
  store (through the Cloudflare Tunnel endpoint) using the `storageRef` pointer —
  the dashboard never talks to the Mac mini directly from the browser, only from its
  own server-side API route (same reasoning as the DynamoDB access pattern: keep
  the storage endpoint and any auth to it server-side only)

## Phase 3 addition — AI query interface
Not designed yet on purpose (see the note in `packages/shared/docs/event-schema.md` —
don't shape this contract until Phase 1 and 2 produce real data to design around).
