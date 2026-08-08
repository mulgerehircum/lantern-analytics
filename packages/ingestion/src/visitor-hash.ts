import { createHash } from "node:crypto";

/**
 * Deterministic anonymous visitor id: hash(IP + UA + daily salt). The salt is
 * derived from the UTC date, so this rotates every 24h — a real privacy
 * commitment (no visitor can be tracked across days by this hash alone), not
 * an implementation detail. Raw IP only ever exists as an input here; it is
 * never persisted anywhere.
 */
export function computeVisitorHash(
  ip: string,
  userAgent: string,
  now: Date = new Date(),
): string {
  const dailySalt = now.toISOString().slice(0, 10); // "2026-08-08"
  return createHash("sha256")
    .update(`${ip}|${userAgent}|${dailySalt}`)
    .digest("hex");
}
