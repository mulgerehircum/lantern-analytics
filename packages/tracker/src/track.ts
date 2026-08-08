import type { CustomEvent } from "@lantern/shared";
import { isValidEventName, sanitizeMetadata } from "@lantern/shared";

/**
 * Builds a CustomEvent for the current page, or null if `name`/`metadata`
 * fail validation. Path always reflects the page the event fired on.
 * Caps live in @lantern/shared so the ingest Lambda enforces identical
 * bounds server-side.
 */
export function buildCustomEvent(
  siteId: string,
  name: unknown,
  metadata: unknown,
): CustomEvent | null {
  if (!isValidEventName(name)) return null;
  const cleanMetadata = sanitizeMetadata(metadata);
  if (!cleanMetadata) return null;

  return {
    siteId,
    name,
    path: location.pathname,
    metadata: cleanMetadata,
    timestamp: new Date().toISOString(),
  };
}
