import { aggregateEvents } from "@/lib/aggregate";
import { getHourlyRollups, getLiveRawEvents, currentHourSK } from "@/lib/dynamodb";
import { summarizeRollups } from "@/lib/summarize";
import { buildRowFilterHref } from "@/lib/filter-ui";
import { DEFAULT_SITE_ID, getSite } from "@/lib/sites";
import { theme } from "@/lib/theme";
import { AppShell } from "@/components/AppShell";
import { DataTableCard } from "@/components/DataTableCard";
import type { DataTableRow } from "@/components/DataTableCard";

/**
 * All-time per-referrer pageview counts - same rollup + live-merge source as
 * the Pages view (see that file's comment). Rows link into Overview's real
 * referrer filter.
 */
export default async function SourcesPage({
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

  const rows: DataTableRow[] = summary.referrers.map((r) => ({
    key: r.referrer || "(empty)",
    count: r.count,
    href: buildRowFilterHref(siteId, "referrer", r.referrer),
  }));

  return (
    <AppShell
      siteId={siteId}
      siteUrl={site?.url}
      activeView="sources"
      basePath="/sources"
      title={
        <>
          {site ? site.name : siteId}
          {!site && <span style={{ fontSize: "0.85rem", fontWeight: 400, color: theme.color.amber }}> - not in site registry</span>}
        </>
      }
    >
      <p style={{ color: theme.color.textMuted, fontSize: "0.82rem", margin: "0 0 1.2rem" }}>
        All-time pageviews per referrer. Click a source to filter the Overview dashboard down to just that source.
      </p>
      <DataTableCard title="All sources" rows={rows} initialVisibleCount={10} exportFilename={`${siteId}-sources.csv`} />
    </AppShell>
  );
}
