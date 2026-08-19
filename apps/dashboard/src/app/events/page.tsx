import { aggregateEvents } from "@/lib/aggregate";
import { getHourlyRollups, getLiveRawEvents, getAllRawEvents, currentHourSK } from "@/lib/dynamodb";
import { getSessionRecordings } from "@/lib/sessions";
import { summarizeRollups } from "@/lib/summarize";
import { buildRowFilterHref, buildEventDetailFilterHref } from "@/lib/filter-ui";
import { findSessionForEvent, parseEventTimestamp } from "@/lib/session-correlation";
import { DEFAULT_SITE_ID, getSite } from "@/lib/sites";
import { theme } from "@/lib/theme";
import { AppShell } from "@/components/AppShell";
import { DataTableCard } from "@/components/DataTableCard";
import type { DataTableRow } from "@/components/DataTableCard";
import { EventOccurrenceList } from "@/components/EventOccurrenceList";
import type { EventOccurrenceRow } from "@/components/EventOccurrenceList";

const MAX_OCCURRENCE_ROWS = 50;

/**
 * All-time custom-event totals plus their metadata breakdown — same rollup +
 * live-merge source as the Pages view (see that file's comment). Rows link
 * into Overview's real eventName / eventKey+eventValue filters.
 */
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const params = await searchParams;
  const requestedSiteId = params.siteId?.trim() || DEFAULT_SITE_ID;
  const site = getSite(requestedSiteId);
  const siteId = site ? site.siteId : requestedSiteId;

  const [rollups, liveEvents, rawEvents, sessions] = await Promise.all([
    getHourlyRollups(siteId),
    getLiveRawEvents(siteId),
    getAllRawEvents(siteId),
    getSessionRecordings(siteId),
  ]);
  const liveRollup = { SK: currentHourSK(), ...aggregateEvents(liveEvents) };
  const summary = summarizeRollups([...rollups, liveRollup]);

  const eventRows: DataTableRow[] = summary.customEvents.map((e) => ({
    key: e.name || "(empty)",
    count: e.count,
    href: buildRowFilterHref(siteId, "eventName", e.name),
  }));
  const detailRows: DataTableRow[] = summary.customEventBreakdown.map((b) => ({
    key: `${b.name} · ${b.dimension}: ${b.value}`,
    count: b.count,
    href: buildEventDetailFilterHref(siteId, b.name, b.dimension, b.value),
  }));

  // Reverse lookup (lib/session-correlation.ts's event→session direction):
  // individual firings, not the all-time aggregates above — necessarily
  // scoped to the trailing ~30-day raw-event window (unlike those
  // aggregates), so the header says so explicitly rather than implying
  // these two sections share one time range.
  const customOccurrences = rawEvents.filter((e) => e.name);
  const occurrences: EventOccurrenceRow[] = [...customOccurrences]
    .sort((a, b) => (parseEventTimestamp(b.SK) ?? 0) - (parseEventTimestamp(a.SK) ?? 0))
    .slice(0, MAX_OCCURRENCE_ROWS)
    .map((e) => {
      const match = findSessionForEvent(e, sessions);
      return {
        timestampIso: new Date(parseEventTimestamp(e.SK) ?? 0).toISOString(),
        name: e.name!,
        metadata: e.metadata,
        country: e.country,
        device: e.device,
        sessionHref: match ? `/sessions/${match.session.sessionId}?siteId=${encodeURIComponent(siteId)}&t=${match.offsetMs}` : undefined,
      };
    });

  return (
    <AppShell
      siteId={siteId}
      siteUrl={site?.url}
      activeView="events"
      basePath="/events"
      title={
        <>
          {site ? site.name : siteId}
          {!site && <span style={{ fontSize: "0.85rem", fontWeight: 400, color: theme.color.amber }}> — not in site registry</span>}
        </>
      }
    >
      <p style={{ color: theme.color.textMuted, fontSize: "0.82rem", margin: "0 0 1.2rem" }}>
        All-time custom event totals. Click an event (or a metadata breakdown row) to filter the Overview
        dashboard down to just that.
      </p>
      <div className="lantern-grid-2" style={{ display: "grid", gap: "1.25rem" }}>
        <DataTableCard title="Custom events" rows={eventRows} initialVisibleCount={10} exportFilename={`${siteId}-custom-events.csv`} />
        <DataTableCard title="Custom event details" rows={detailRows} initialVisibleCount={10} exportFilename={`${siteId}-custom-event-details.csv`} />
      </div>

      <div style={{ marginTop: "1.25rem" }}>
        <EventOccurrenceList rows={occurrences} totalCount={customOccurrences.length} />
      </div>
    </AppShell>
  );
}
