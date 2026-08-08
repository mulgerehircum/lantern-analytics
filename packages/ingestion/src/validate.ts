import type { CustomEvent, PageviewEvent, TrackedEvent } from "@lantern/shared";
import { isValidEventName, sanitizeMetadata } from "@lantern/shared";

/**
 * Parses and validates the raw request body into a TrackedEvent (pageview or
 * custom event), or returns null for anything malformed. The ingest endpoint
 * is public (any embedding site can POST to it), so nothing about the payload
 * shape can be trusted until it passes through here. Custom-event names and
 * metadata are checked against the same caps the tracker enforces client-side
 * (shared constants, see @lantern/shared/metadata).
 */
export function parseTrackedEvent(body: string | undefined): TrackedEvent | null {
  if (!body) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const { siteId, path, timestamp, referrer, name, metadata } = parsed as Record<string, unknown>;

  if (typeof siteId !== "string" || !siteId) return null;
  if (typeof path !== "string") return null;
  if (typeof timestamp !== "string" || Number.isNaN(Date.parse(timestamp))) return null;

  // Presence of `name` discriminates a custom event from a pageview — the
  // tracker never sends it on pageviews.
  if (name !== undefined) {
    if (!isValidEventName(name)) return null;
    const cleanMetadata = sanitizeMetadata(metadata);
    if (!cleanMetadata) return null;

    const customEvent: CustomEvent = { siteId, name, path, metadata: cleanMetadata, timestamp };
    return customEvent;
  }

  if (typeof referrer !== "string") return null;
  const pageview: PageviewEvent = { siteId, path, referrer, timestamp };
  return pageview;
}

/**
 * Pageview-only view over parseTrackedEvent, kept for callers/tests that only
 * deal with pageviews.
 */
export function parsePageviewEvent(body: string | undefined): PageviewEvent | null {
  const event = parseTrackedEvent(body);
  if (!event || "name" in event) return null;
  return event;
}
