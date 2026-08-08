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
  devices: { "desktop": 250, "mobile": 92 }
}
```
No TTL on rollups — these are the permanent record; raw events are disposable once rolled up.

## Query patterns this supports
- Dashboard "traffic over time" → query `PK = SITE#x, SK begins_with AGG#<date>` (cheap, no scan)
- Rollup job → query `PK = SITE#x, SK begins_with EVENT#<hour-range>` for events since the last rollup, aggregate in-process, write one `AGG#` item, let TTL clean up the raw events
- No GSI needed yet — everything is scoped to a single site's partition. Would add one only if cross-site queries (e.g., "all sites owned by user Y") become a real requirement later.

## Open question (not decided yet)
Rollup trigger: DynamoDB Streams + a Lambda consumer (near-real-time, more moving
parts) vs. a scheduled Lambda every N minutes (simpler, small delay before new data
shows in the dashboard). Leaning scheduled for Phase 1 — simpler is better until
there's a reason to need near-real-time.
