import { aggregateEvents } from "./aggregate";
import { queryRawEventsForHour, putHourlyRollup, hourPrefix } from "./rollup-store";

/**
 * Scheduled (EventBridge, e.g. `rate(1 hour)`) trigger — not a DynamoDB
 * Streams consumer. Rolls up the *previous complete* hour, not the current
 * one, so a run that fires a few minutes after the hour boundary never
 * misses events still trickling in for that hour. See docs/dynamodb-schema.md
 * "open question" for the streams-vs-scheduled trade-off this settled.
 *
 * `SITE_IDS` (comma-separated) stands in for a real site registry, which
 * doesn't exist yet in Phase 1 — this is a known, explicit simplification,
 * not an oversight.
 */
export async function handler(): Promise<void> {
  const siteIds = (process.env.SITE_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (siteIds.length === 0) return;

  const hour = hourPrefix(new Date(Date.now() - 60 * 60 * 1000));

  for (const siteId of siteIds) {
    const events = await queryRawEventsForHour(siteId, hour);
    if (events.length === 0) continue;
    await putHourlyRollup(siteId, hour, aggregateEvents(events));
  }
}
