import type { SessionRecordingMeta } from "@lantern/shared";
import {
  isValidSessionId,
  isValidSiteIdForPath,
  MAX_SESSION_DURATION_MS,
  MAX_SESSION_PAGE_COUNT,
} from "@lantern/shared";

/**
 * Parses and validates a session-recording metadata heartbeat, or returns
 * null for anything malformed. Like `validate.ts`'s `parseTrackedEvent`, this
 * endpoint is public — nothing on the wire is trusted.
 *
 * `storageRef` is deliberately NEVER read from the request body: it is always
 * computed here as `${siteId}/${sessionId}`, matching the path the Mac-mini
 * receiver (packages/recorder-receiver) stores the blob under. Accepting a
 * client-supplied `storageRef` would let a crafted payload plant an arbitrary
 * path string that the dashboard later uses to request a blob — see
 * packages/shared/docs/event-schema.md for the full reasoning.
 */
export function parseSessionRecordingMeta(body: string | undefined): SessionRecordingMeta | null {
  if (!body) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const { siteId, sessionId, startedAt, durationMs, pageCount } = parsed as Record<string, unknown>;

  if (!isValidSiteIdForPath(siteId)) return null;
  if (!isValidSessionId(sessionId)) return null;
  if (typeof startedAt !== "string" || Number.isNaN(Date.parse(startedAt))) return null;
  if (typeof durationMs !== "number" || durationMs < 0 || durationMs > MAX_SESSION_DURATION_MS) return null;
  if (typeof pageCount !== "number" || pageCount <= 0 || pageCount > MAX_SESSION_PAGE_COUNT) return null;

  return {
    siteId,
    sessionId,
    startedAt,
    durationMs,
    pageCount,
    storageRef: `${siteId}/${sessionId}`,
  };
}
