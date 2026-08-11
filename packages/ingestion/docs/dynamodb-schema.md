# DynamoDB Schema — Phase 1

Single table, denormalized. DynamoDB is bad at ad-hoc aggregation, so the design
splits raw events (write-heavy, short-lived) from precomputed rollups (read-heavy,
what the dashboard actually queries).

## Table: `lantern-events`

| Attribute | Type | Notes |
|---|---|---|
| `PK` | String | `SITE#<siteId>` |
| `SK` | String | `EVENT#<isoTimestamp>#<eventId>` (raw) or `AGG#<date>#<hour>` (rollup) |
| `TTL` | Number (epoch seconds) | Raw events only — auto-expire after 30 days to stay inside the 25GB free tier |

### Item: raw pageview event
```
PK: SITE#abc123
SK: EVENT#2026-08-08T14:32:10Z#f8e2c1
{
  path: "/pricing",
  referrer: "https://google.com",
  country: "MD",
  device: "desktop",
  visitorHash: "9f2a...",   // hashed IP + UA, never raw IP — privacy requirement
  ttl: 1736345530
}
```

### Item: raw custom event (fired via `window.lantern.track("contact_click", { platform: "email" })`)
Same stream/query shape as a pageview — discriminated by the presence of `name`.
```
PK: SITE#abc123
SK: EVENT#2026-08-08T14:32:10Z#f8e2c1
{
  name: "contact_click",
  metadata: { platform: "email" },
  path: "/contact",
  country: "MD",
  device: "desktop",
  visitorHash: "9f2a...",
  ttl: 1736345530
}
```
`name`/`metadata` are validated and capped client-side (tracker) and server-side
(ingest) against shared limits in `@lantern/shared/metadata` — the endpoint is
public, so nothing on the wire is trusted. Metadata values may be string,
number, or boolean; only string values are rolled up as dimensions.

### Item: hourly rollup (written by a rollup Lambda, not the ingestion handler directly)
```
PK: SITE#abc123
SK: AGG#2026-08-08#14
{
  pageviews: 342,
  uniques: 210,
  topPages: { "/pricing": 88, "/": 140, "/docs": 45 },
  referrers: { "google.com": 120, "direct": 90 },
  countries: { "MD": 40, "PL": 60 },
  devices: { "desktop": 250, "mobile": 92 },
  customEvents: { "contact_click": 3, "section_view": 10 },
  eventDimensions: {
    "project_link_click": {
      "project_title": { "PDFloom": 2, "Dataroom": 1 },
      "link_type": { "github": 2, "live": 1 }
    }
  }
}
```
Custom events never contribute to `pageviews`/`uniques` — those count pageviews
only. `eventDimensions` is keyed by event name → metadata key → string value.
Known tradeoff: high-cardinality string metadata (e.g. per-visit IDs) would
bloat rollup items, so string metadata is assumed to be low-cardinality.
Rollups written before custom events existed simply lack the last two fields;
the dashboard treats them as absent.
No TTL on rollups — these are the permanent record; raw events are disposable once rolled up.

### Item: session recording metadata (Phase 2 — written by the metadata-ingest Lambda, `session-meta-handler.ts`)
```
PK: SITE#abc123
SK: SESSION#2026-08-08T14:30:00.000Z#a1b2c3d4e5f6
{
  sessionId: "a1b2c3d4e5f6",
  startedAt: "2026-08-08T14:30:00.000Z",
  durationMs: 184000,
  pageCount: 4,
  storageRef: "abc123/a1b2c3d4e5f6"   // points at the blob on the Mac-mini receiver, never the blob itself
}
```
The actual rrweb event stream never lands in this table — it's an opaque blob
on the self-hosted receiver (`packages/recorder-receiver`), addressed by
`storageRef`. `storageRef` is always computed server-side as
`${siteId}/${sessionId}` (`session-meta-validate.ts`); a client-supplied
`storageRef` in the request body is ignored. Repeated heartbeats for the same
session (the tracker sends one roughly every 3rd flush) simply overwrite this
item — same PK+SK, no atomic counters needed since `durationMs`/`pageCount`
just increase monotonically. No TTL, same reasoning as `AGG#` rollups.

## Query patterns this supports
- Dashboard "traffic over time" → query `PK = SITE#x, SK begins_with AGG#<date>` (cheap, no scan)
- Rollup job → query `PK = SITE#x, SK begins_with EVENT#<hour-range>` for events since the last rollup, aggregate in-process, write one `AGG#` item, let TTL clean up the raw events
- Dashboard "sessions list" (Phase 2) → query `PK = SITE#x, SK begins_with SESSION#`, `ScanIndexForward: false` for newest-first (free from the ISO-8601 timestamp in the SK)
- No GSI needed yet — everything is scoped to a single site's partition. Would add one only if cross-site queries (e.g., "all sites owned by user Y") become a real requirement later.

## Open question (not decided yet)
Rollup trigger: DynamoDB Streams + a Lambda consumer (near-real-time, more moving
parts) vs. a scheduled Lambda every N minutes (simpler, small delay before new data
shows in the dashboard). Leaning scheduled for Phase 1 — simpler is better until
there's a reason to need near-real-time.
