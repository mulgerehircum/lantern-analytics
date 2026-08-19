import { aggregateEvents } from "@/lib/aggregate";
import { getHourlyRollups, getLiveRawEvents, currentHourSK } from "@/lib/dynamodb";
import { summarizeRollups } from "@/lib/summarize";
import { buildRowFilterHref, buildEventDetailFilterHref } from "@/lib/filter-ui";
import { DEFAULT_SITE_ID, getSite } from "@/lib/sites";
import { theme } from "@/lib/theme";
import { AppShell } from "@/components/AppShell";
import { DataTableCard } from "@/components/DataTableCard";
import type { DataTableRow } from "@/components/DataTableCard";

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

  const [rollups, liveEvents] = await Promise.all([getHourlyRollups(siteId), getLiveRawEvents(siteId)]);
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
    </AppShell>
  );
}
