import type { PageviewEvent } from "@lantern/shared";

/**
 * Parses and validates the raw request body into a PageviewEvent, or returns
 * null for anything malformed. The ingest endpoint is public (any embedding
 * site can POST to it), so nothing about the payload shape can be trusted
 * until it passes through here.
 */
export function parsePageviewEvent(body: string | undefined): PageviewEvent | null {
  if (!body) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const { siteId, path, referrer, timestamp } = parsed as Record<string, unknown>;

  if (typeof siteId !== "string" || !siteId) return null;
  if (typeof path !== "string") return null;
  if (typeof referrer !== "string") return null;
  if (typeof timestamp !== "string" || Number.isNaN(Date.parse(timestamp))) return null;

  return { siteId, path, referrer, timestamp };
}
