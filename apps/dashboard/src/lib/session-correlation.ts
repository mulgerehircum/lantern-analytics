import type { RawEventRecordWithKey } from "./dynamodb";
import type { SessionRecordingItem } from "./sessions";

/**
 * Matches raw custom events to session recordings by visitorHash + time
 * window, in both directions. Generalizes the join `attachVariantToSessions`
 * (lib/experiment.ts) already does for one specific event type — rollups
 * can't answer this (they only ever store counts, never individual
 * timestamps/visitorHash, see packages/ingestion/src/aggregate.ts), so this
 * always works from `getAllRawEvents`'s raw EVENT# items, same ~30-day TTL
 * coverage limit as everything else that reads raw events.
 */

/** "EVENT#2026-08-08T14:32:10Z#f8e2c1" -> epoch ms of "2026-08-08T14:32:10Z". */
export function parseEventTimestamp(sk: string): number | null {
  const part = sk.split("#")[1];
  if (!part) return null;
  const ms = Date.parse(part);
  return Number.isNaN(ms) ? null : ms;
}

// A real interaction should land inside the session's own window, but clock
// skew between client send and server receive plus queued/batched delivery
// can push it slightly outside — tolerate a few minutes on either edge
// rather than requiring an exact bound. Same rationale/value as the
// card_variant_view-specific tolerance this generalizes.
export const DEFAULT_MATCH_TOLERANCE_MS = 5 * 60 * 1000;

function getSessionWindow(
  session: Pick<SessionRecordingItem, "startedAt" | "durationMs">,
): { startMs: number; endMs: number } | null {
  const startMs = Date.parse(session.startedAt);
  if (Number.isNaN(startMs)) return null;
  return { startMs, endMs: startMs + session.durationMs };
}

/**
 * All custom-event occurrences (events with a `name` — plain pageviews are
 * excluded) whose visitorHash + timestamp fall within `session`'s window
 * (± tolerance), each annotated with its millisecond offset into the
 * session — clamped into [0, durationMs] so a slightly-outside-tolerance
 * match still lands at a sane position rather than a negative/overflowing
 * one. Sorted ascending by offset, ready to feed a timeline directly.
 */
export function findCustomEventsForSession(
  session: SessionRecordingItem,
  events: RawEventRecordWithKey[],
  toleranceMs: number = DEFAULT_MATCH_TOLERANCE_MS,
): Array<RawEventRecordWithKey & { offsetMs: number }> {
  if (!session.visitorHash) return [];
  const window = getSessionWindow(session);
  if (!window) return [];

  const matches: Array<RawEventRecordWithKey & { offsetMs: number }> = [];
  for (const event of events) {
    if (!event.name || event.visitorHash !== session.visitorHash) continue;
    const ts = parseEventTimestamp(event.SK);
    if (ts === null || ts < window.startMs - toleranceMs || ts > window.endMs + toleranceMs) continue;
    const offsetMs = Math.min(Math.max(ts - window.startMs, 0), session.durationMs);
    matches.push({ ...event, offsetMs });
  }
  return matches.sort((a, b) => a.offsetMs - b.offsetMs);
}

export interface SessionEventMatch {
  session: SessionRecordingItem;
  offsetMs: number;
}

/**
 * The session `event` happened in, if any. `sessions` should be newest-first
 * (as `getSessionRecordings` already returns) — the first matching session
 * wins, so an overlapping-window tie (rare: two recordings for one visitor
 * whose windows both cover the same instant) resolves to the more recent
 * one. `null` is the common, expected case (the event predates any
 * recording, or the recording has already expired past its own retention) —
 * callers must degrade gracefully, not treat it as an error.
 */
export function findSessionForEvent(
  event: RawEventRecordWithKey,
  sessions: SessionRecordingItem[],
  toleranceMs: number = DEFAULT_MATCH_TOLERANCE_MS,
): SessionEventMatch | null {
  if (!event.visitorHash) return null;
  const ts = parseEventTimestamp(event.SK);
  if (ts === null) return null;

  for (const session of sessions) {
    if (session.visitorHash !== event.visitorHash) continue;
    const window = getSessionWindow(session);
    if (!window) continue;
    if (ts < window.startMs - toleranceMs || ts > window.endMs + toleranceMs) continue;
    const offsetMs = Math.min(Math.max(ts - window.startMs, 0), session.durationMs);
    return { session, offsetMs };
  }
  return null;
}
