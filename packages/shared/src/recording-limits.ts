/**
 * Shared bounds and validation for session recording (Phase 2). Tracker,
 * ingestion (metadata Lambda), and the Mac-mini receiver all enforce these
 * independently — every one of them is a public endpoint, nothing on the
 * wire is trusted — so the rules live here once to keep them from drifting.
 */

/** Matches the tracker's generated session IDs (crypto.randomUUID() minus
 * dashes, or similar) and doubles as a filesystem-path-safety check on the
 * receiver, which uses siteId/sessionId directly in a file path. */
export const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

/** Tighter than a generic "non-empty string" siteId check elsewhere in the
 * project, specifically because the receiver uses this in a file path too. */
export const SITE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export const SESSION_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 min idle -> new session
export const MAX_SESSION_DURATION_MS = 4 * 60 * 60 * 1000; // hard cap regardless of activity
export const MAX_SESSION_PAGE_COUNT = 500; // sanity bound, not a real UX cap

export function isValidSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID_PATTERN.test(value);
}

export function isValidSiteIdForPath(value: unknown): value is string {
  return typeof value === "string" && SITE_ID_PATTERN.test(value);
}
