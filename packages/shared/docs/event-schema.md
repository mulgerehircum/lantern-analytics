# Event Schema — Phase 1

The contract between `@lantern/tracker` (produces), `@lantern/ingestion` (validates +
stores), and `@lantern/dashboard` (reads via rollups). Kept intentionally small —
add fields when a real dashboard need shows up, not speculatively.

## PageviewEvent (sent by the tracker, over the wire)

```ts
interface PageviewEvent {
  siteId: string;        // which site's tracking script sent this
  path: string;          // e.g. "/pricing" — no query string (privacy: query params can leak PII)
  referrer: string;      // hostname only, e.g. "google.com" — never the full referrer URL
  timestamp: string;     // ISO 8601, set client-side
  visitorHash: string;   // hash of (IP + User-Agent + daily salt), computed server-side on
                          // ingest, NEVER sent by the client — the client has no way to
                          // compute this without seeing its own IP, and trusting a
                          // client-supplied hash would let anyone forge unique-visitor counts
}
```

Note the asymmetry: the tracker does NOT compute `visitorHash` — it sends raw signal
(nothing, actually; the Lambda reads the request's source IP directly) and the Lambda
hashes IP + UA + a rotating daily salt before it ever touches storage. This is the
actual privacy mechanism, not the tracker script — worth being precise about which
component is really responsible for privacy so the story holds up under a real
question in an interview.

## Derived at ingest time (not sent by the client)

```ts
interface EnrichedPageviewEvent extends Omit<PageviewEvent, "visitorHash"> {
  visitorHash: string;   // computed here, from source IP (never persisted raw)
  country: string;       // derived from IP via a geo-lookup, IP itself discarded after
  device: "desktop" | "mobile" | "tablet";  // derived from User-Agent
}
```

This is the shape written into DynamoDB as a raw `EVENT#` item (see
`packages/ingestion/docs/dynamodb-schema.md`).

## Session recording metadata (Phase 2 — not built yet)

```ts
interface SessionRecordingMeta {
  siteId: string;
  sessionId: string;
  startedAt: string;
  durationMs: number;
  pageCount: number;
  storageRef: string;    // pointer to the blob on the Mac-mini-hosted store, not the blob itself
}
```

The actual rrweb event stream is never modeled here — it's an opaque blob handed to
storage as-is. Only metadata needs a shared type, since that's the only part
DynamoDB and the dashboard touch directly.

## What's deliberately NOT in this schema yet
- Anything AI/query-layer related (Phase 3) — don't design that contract until Phase 1
  and 2 exist and there's real data to shape it around.
- Raw IP address — never modeled, never stored, discarded immediately after
  `visitorHash` + `country` are derived.
