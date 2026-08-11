import { timingSafeEqual } from "node:crypto";

/**
 * Checks an `Authorization: Bearer <token>` header against an expected
 * token using a constant-time comparison (avoids leaking the correct token
 * one byte at a time via response-time differences).
 */
export function checkBearer(header: string | undefined, expectedToken: string): boolean {
  if (!header || !expectedToken) return false;

  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;

  const provided = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(expectedToken);
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}
