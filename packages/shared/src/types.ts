// Contract between tracker, ingestion, and dashboard. See
// packages/ingestion/docs/dynamodb-schema.md for the stored shapes — keep this
// in sync with that doc.

/** A custom event fired via `window.lantern.track(name, metadata)` — e.g.
 * `section_view`, `contact_click`, `project_link_click`. Discriminated from a
 * pageview by the presence of `name`. */
export interface CustomEvent {
  siteId: string;
  name: string;
  path: string;
  metadata: Record<string, string | number | boolean>;
  timestamp: string;
}

/** Sent by the tracker script over the wire. */
export interface PageviewEvent {
  siteId: string;
  path: string;
  /** Hostname only, e.g. "google.com" — never the full referrer URL. */
  referrer: string;
  timestamp: string;
}

/** Anything the tracker can send: either a pageview or a named custom event. */
export type TrackedEvent = PageviewEvent | CustomEvent;

/** Written to DynamoDB by the ingestion Lambda; never sent by the client. */
export interface EnrichedPageviewEvent extends Omit<PageviewEvent, never> {
  visitorHash: string;
  country: string;
  device: "desktop" | "mobile" | "tablet";
}

/** Written to DynamoDB by the ingestion Lambda; never sent by the client. */
export interface EnrichedCustomEvent extends Omit<CustomEvent, never> {
  visitorHash: string;
  country: string;
  device: "desktop" | "mobile" | "tablet";
}

/** Phase 2 — session recording metadata (the blob itself lives on the Mac mini). */
export interface SessionRecordingMeta {
  siteId: string;
  sessionId: string;
  startedAt: string;
  durationMs: number;
  pageCount: number;
  storageRef: string;
  /** Landing page path — the value from the session's first heartbeat only;
   * later heartbeats (from later pages, if the session spans more than one)
   * never overwrite it. See ingestion's dynamodb.ts putSessionRecordingMeta. */
  path: string;
  /** Landing referrer, hostname only (see tracker's referrer.ts) — same
   * "first heartbeat wins" rule as `path`. */
  referrer: string;
  /** Server-derived, same as EnrichedPageviewEvent/EnrichedCustomEvent —
   * never sent by the client. */
  country: string;
  device: "desktop" | "mobile" | "tablet";
  visitorHash: string;
}
