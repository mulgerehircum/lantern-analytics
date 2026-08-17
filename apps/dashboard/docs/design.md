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
The dashboard owner asks natural-language questions about their own site's
stats. `POST /api/ai-query` (`{ siteId, question, monthPrefix? }`) reuses the
existing `getHourlyRollups` + `summarizeRollups` pipeline unchanged — no new
aggregation logic — and hands the resulting `DashboardSummary` plus the
question to `src/lib/ai-query.ts`, which calls the Gemini API directly
(`@google/genai`, server-side only, `GEMINI_API_KEY`; see `docs/decisions.md`
for why this is a direct call rather than going through Firebase AI Logic).

Untrusted-data boundary: topPages paths, referrers, and custom-event
names/metadata all originate from real website visitors, so they're
adversary-controlled strings that end up inside the Gemini prompt. The system
prompt in `ai-query.ts` explicitly instructs the model to treat every string
value in the stats JSON as inert data, never as instructions.

No auth exists on this route yet (matches the rest of this single-operator
dashboard). The only guard against quota abuse is a question-length cap; a
real rate limit is deferred until there's an actual reason to add one — see
`docs/decisions.md`. Gemini's own free-tier quota (5 requests/minute for
`gemini-3.6-flash` at time of writing) is a real backstop on top of that.

The client-side query box that would call this route is not built yet — see
the insights box below for the first (and, for now, only) AI feature
actually wired into the UI.

### Insights box — 3 auto-generated observation + action pairs
`page.tsx` (a Server Component) calls `getInsights(summary)` directly,
server-side, the same way it already calls `getHourlyRollups` — no HTTP
round trip through `/api/*`, unlike the recordings and Q&A routes, which
exist specifically because their callers (`ReplayPlayer`, an eventual query
box) are client components that need the DOM. `getInsights` asks Gemini for
exactly 3 insights back as structured JSON (`responseMimeType:
"application/json"` + `responseSchema`) rather than free text, so the UI can
render a reliable list without parsing markdown out of an answer.

Each insight is a pair, not a bare sentence: `observation` (what the data
shows, grounded in real numbers) and `action` (one concrete next step that
follows from it) — plain description alone ("desktop dominates traffic")
wasn't useful enough on its own; pairing it with a suggested response is.
The prompt steers the model toward `customEvents`/`customEventBreakdown`
specifically, since those are real engagement actions the site owner chose
to track (clicks, downloads, filters used) and tend to produce sharper,
more actionable insights than raw pageview/device/country volume alone —
but it also checks that the data actually carries information first:
single-valued dimensions (every event mapping to one constant value — the
motivating example was the `andrii-portfolio` site's `cv_download` event,
whose `filename` metadata was a hardcoded `"CV.pdf"` on every call in that
site's own tracking code, a different repo from this one — the AI insights
surfaced it as a hollow "insight" before the source was fixed to drop that
field entirely) and near-zero counts (1-2 occurrences) get skipped as
noise, falling back to pageviews/referrers/countries/devices instead of
forcing a hollow custom-event insight into one of the 3 slots.

`getInsights` also optionally takes a `sessionsSummary` (from
`summarizeSessions`, over `getSessionRecordings(siteId)` — Phase 2's
session-recording data). This is aggregate-only, same discipline as
everything else fed to Gemini: session count, average duration/page count,
bounce rate, and top landing pages — never per-session detail (no
`visitorHash`, no per-session path sequence, no `storageRef`). It's real
on-site behavior signal (how long people actually stay, how deep they go)
that pageview/rollup counts alone can't show. Omitted from the prompt
entirely when there are 0 sessions — nothing to say about it — and it is
NOT scoped to the currently-viewed period/filters the way `summary` is
(`getSessionRecordings` has no period param), which the prompt explicitly
tells the model so it doesn't imply false precision about the window.
Rendered as `InsightsBox`, right under the top-line pageview/unique stats.

Skipped (not called at all) when `summary.totalPageviews === 0` — nothing
to say about an empty site, and no reason to spend a Gemini call on it.
Any failure (missing `GEMINI_API_KEY`, network/quota error, malformed
JSON) is caught and logged; `insights` stays `null` and the box just
doesn't render — the AI layer is additive and never blocks the rest of
the dashboard from rendering.

Wrapped in `unstable_cache` (`next/cache`), keyed on `siteId` + period +
filter state, `revalidate: 3600`. This box fires unconditionally on every
page load, which burns through Gemini's free-tier 5-requests/minute cap
within a couple of reloads or filter clicks — caching is what actually
prevents that, the try/catch above only prevents a *failed* call from
breaking the page. The cache key deliberately does not include `summary`'s
content (only the view identity: which site, which period, filtered or
not) — `unstable_cache` also folds in a wrapped function's own arguments,
so `summary` is passed via closure instead of as an argument specifically
to keep it out of the key. That means insights can go stale relative to
the underlying numbers for up to an hour, which is intentional: rollups
themselves only update on the hourly EventBridge schedule (see
`packages/ingestion/infra/lib/lantern-stack.ts`), so insights can't be
meaningfully fresher than the data they summarize anyway. On Vercel this
gets real stale-while-revalidate semantics — an expired entry is served
immediately while regenerating in the background, not blocked on it.

`gemini-3.6-flash` spends a variable, data-size-dependent chunk of its
output budget on internal "thinking" tokens before emitting the JSON, which
silently truncated the response mid-string during testing at lower
`maxOutputTokens`; `getInsights` uses 2048 for headroom (`askQuestion`
stays at 512 — free-text answers are capped much shorter by design, see
its system prompt). Disabling thinking outright (`thinkingConfig:
{ thinkingBudget: 0 }`) was tried to remove that variability at the root;
this model rejects budget 0 with a 400, so a generous fixed budget is the
fallback instead.
