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
 * All-time per-path pageview counts, sourced straight from the AGG# rollups
 * (unlimited history, unlike the dimension-filtered ~30-day raw-event
 * window) — same live-current-hour merge as the Overview's all-time view, so
 * totals stay consistent between the two. Rows link into Overview's real
 * path filter (lib/filter-ui.ts) rather than duplicating filtering here.
 */
export default async function PagesPage({
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

  const rows: DataTableRow[] = summary.topPages.map((p) => ({
    key: p.path || "(empty)",
    count: p.count,
    href: buildRowFilterHref(siteId, "path", p.path),
  }));

  return (
    <AppShell
      siteId={siteId}
      siteUrl={site?.url}
      activeView="pages"
      basePath="/pages"
      title={
        <>
          {site ? site.name : siteId}
          {!site && <span style={{ fontSize: "0.85rem", fontWeight: 400, color: theme.color.amber }}> — not in site registry</span>}
        </>
      }
    >
      <p style={{ color: theme.color.textMuted, fontSize: "0.82rem", margin: "0 0 1.2rem" }}>
        All-time pageviews per path. Click a page to filter the Overview dashboard down to just that page.
      </p>
      <DataTableCard title="All pages" rows={rows} initialVisibleCount={10} exportFilename={`${siteId}-pages.csv`} />
    </AppShell>
  );
}
