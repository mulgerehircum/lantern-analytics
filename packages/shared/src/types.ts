// Contract between tracker, ingestion, and dashboard. See docs/event-schema.md
// for the full reasoning — keep this in sync with that doc.

/** Sent by the tracker script over the wire. */
export interface PageviewEvent {
  siteId: string;
  path: string;
  /** Hostname only, e.g. "google.com" — never the full referrer URL. */
  referrer: string;
  timestamp: string;
}

/** Written to DynamoDB by the ingestion Lambda; never sent by the client. */
export interface EnrichedPageviewEvent extends Omit<PageviewEvent, never> {
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
}
