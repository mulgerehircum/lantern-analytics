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

  const hour = hourPrefix(new Date(Date.now() - 60 * 60 * 1000));

  // Every run logs an aggregate-only summary (counts, never raw events/paths/
  // hashes/IPs) so a missing dashboard datapoint is one CloudWatch query away
  // from being explained — the scheduled + TTL two-tier model is otherwise a
  // black box.
  if (siteIds.length === 0) {
    console.log(JSON.stringify({ rollup: { hour, sites: 0, status: "no-sites-configured" } }));
    return;
  }

  for (const siteId of siteIds) {
    const events = await queryRawEventsForHour(siteId, hour);
    if (events.length === 0) {
      console.log(JSON.stringify({ rollup: { hour, siteId, eventCount: 0, status: "empty" } }));
      continue;
    }
    const rollup = aggregateEvents(events);
    await putHourlyRollup(siteId, hour, rollup);
    console.log(
      JSON.stringify({
        rollup: {
          hour,
          siteId,
          status: "wrote",
          eventCount: events.length,
          pageviews: rollup.pageviews,
          uniques: rollup.uniques,
          customEvents: Object.keys(rollup.customEvents).length,
        },
      }),
    );
  }
}
