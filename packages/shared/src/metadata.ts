/**
 * Shared client/server bounds and sanitization for custom-event metadata.
 * The tracker enforces these before sending, the ingest Lambda re-enforces
 * them server-side (the endpoint is public, nothing on the wire is trusted).
 * Kept in the shared package so the two never drift.
 */

export const MAX_EVENT_NAME_LENGTH = 64;
export const MAX_METADATA_KEYS = 16;
export const MAX_METADATA_KEY_LENGTH = 64;
export const MAX_STRING_METADATA_VALUE_LENGTH = 256;

export type MetadataValue = string | number | boolean;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates an event name: non-empty string within the length bound.
 */
export function isValidEventName(name: unknown): name is string {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name.length <= MAX_EVENT_NAME_LENGTH
  );
}

/**
 * Sanitizes client-supplied metadata into the wire shape, or returns null so
 * the caller can drop the event entirely. Strict on purpose: a single garbage
 * value means the caller passed bad data, and a silently-truncated event would
 * just hide that from the site owner.
 */
export function sanitizeMetadata(
  input: unknown,
): Record<string, MetadataValue> | null {
  if (input === undefined) return {};
  if (!isPlainObject(input)) return null;

  const keys = Object.keys(input);
  if (keys.length > MAX_METADATA_KEYS) return null;

  const metadata: Record<string, MetadataValue> = {};
  for (const key of keys) {
    if (key.length > MAX_METADATA_KEY_LENGTH) return null;
    const value = input[key];
    if (typeof value === "string") {
      if (value.length > MAX_STRING_METADATA_VALUE_LENGTH) return null;
      metadata[key] = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      metadata[key] = value;
    } else {
      return null;
    }
  }
  return metadata;
}
