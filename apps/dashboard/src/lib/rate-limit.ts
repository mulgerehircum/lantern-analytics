/**
 * In-memory, per-instance rate limiter guarding the AI query route's shared
 * Gemini quota. Deliberately global, not per-IP/per-caller: the resource
 * being protected — Gemini's account-level free-tier quota — is itself
 * global and shared across every caller, and this route has no
 * authenticated identity to key a per-caller limit on anyway (see
 * docs/design.md's Phase 3 section: "No auth exists on this route yet").
 * A per-IP limiter would still let enough different IPs exhaust the same
 * shared quota, so it wouldn't actually protect the thing that matters.
 *
 * State is process-local: a cold start or a second concurrent Vercel
 * function instance resets or bypasses it. Accepted as a best-effort
 * throttle rather than a hard guarantee — it still meaningfully slows a
 * single abusive script hitting a warm instance repeatedly, at zero added
 * infra. A DynamoDB- or Upstash-backed counter would be a real distributed
 * limiter, but the dashboard's DynamoDB credentials are deliberately
 * read-only (see docs/design.md's "Data access" section) and widening that
 * scope isn't warranted until in-memory proves insufficient in practice.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;

let windowStart = 0;
let requestCount = 0;

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the current window resets. 0 when allowed. */
  retryAfterSeconds: number;
}

/** `now` is only ever overridden by tests. */
export function checkRateLimit(now: number = Date.now()): RateLimitResult {
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    requestCount = 0;
  }

  requestCount += 1;

  if (requestCount > MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((windowStart + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/** Test-only: resets module state between test cases. */
export function resetRateLimitForTests(): void {
  windowStart = 0;
  requestCount = 0;
}
