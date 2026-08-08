# Tracker Script — Design

## Responsibilities (and deliberately not more)
- Fire one `PageviewEvent` (see `packages/shared/docs/event-schema.md`) per page load
- Nothing else in Phase 1 — no client-side hashing, no cookies, no localStorage identity,
  no session stitching. Uniqueness is entirely the ingestion Lambda's job (it hashes
  source IP + UA + daily salt), which keeps the client script trivially small and means
  there's no client-side secret/salt to leak or reverse-engineer.

## Transport
`navigator.sendBeacon(endpoint, payload)` as the primary path — it's designed exactly
for this (fire-and-forget, survives page unload, no response needed). Fall back to
`fetch(..., { keepalive: true })` only if `sendBeacon` is unavailable (very old browsers).
Never block page rendering on this — the script must be async and never in the
critical render path.

## What "cookieless" actually means here
No cookies are set, full stop. Consequence: no cross-session identity, no client-side
opt-out state to manage, no cookie-consent banner needed for this feature. Uniqueness
is a derived server-side hash (IP + UA + daily-rotating salt) that changes every 24h —
this is what "cookieless but still counts unique visitors" means in practice, same
mechanism Plausible/Simple Analytics use.

The one deliberate exception to "no browser storage": the owner can set a
`lantern_ignore` localStorage flag (via `window.lantern.ignore()` or the documented
one-liner) that makes the tracker no-op. This is a user-set preference, never written
for visitors, and holds no identity — see `ignore.ts`.

## DNT / privacy signals
Respect `navigator.doNotTrack` — if set, the script no-ops entirely (doesn't even fire
the beacon). This is a real behavioral commitment, not just a settings toggle buried in
a dashboard — matches the project's privacy-first positioning.

## Referrer handling
Strip to hostname only before sending (`new URL(document.referrer).hostname`), never
the full referrer URL — a full URL can carry query params with PII (e.g. a password
reset link, a pre-filled email in a query string on the referring page).

## Bundle size target
Under 2KB gzipped for Phase 1 (pageview beacon only — this excludes rrweb, which is
Phase 2 and loaded as a separate, opt-in chunk so sites that only want pageview
counts don't pay the session-recording bundle cost). This is worth stating as a
concrete, testable target now rather than discovering bloat after the fact.

## Phase 2 addition (not built yet)
rrweb loaded as a lazy/separate script tag, only when session recording is enabled
for a site — never bundled into the base tracker.
