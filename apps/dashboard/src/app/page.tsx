import { unstable_cache } from "next/cache";
import { aggregateEvents } from "@/lib/aggregate";
import { getHourlyRollups, getLiveRawEvents, getAllRawEvents, currentHourSK } from "@/lib/dynamodb";
import { getSessionRecordings } from "@/lib/sessions";
import { getInsights } from "@/lib/ai-query";
import type { Insight } from "@/lib/ai-query";
import { summarizeRollups, summarizeMonthlyTrend, summarizeDailyTrend, summarizeSessions, computePeriodComparison } from "@/lib/summarize";
import type { DashboardSummary, MonthlyTrendPoint, DailyTrendPoint, PeriodComparison } from "@/lib/summarize";
import { buildFilteredRollups, hasActiveFilter, parseFilters } from "@/lib/filter";
import { DEFAULT_SITE_ID, getSite } from "@/lib/sites";
import { theme, card } from "@/lib/theme";
import { AppShell } from "@/components/AppShell";
import { AiQueryBox } from "@/components/AiQueryBox";
import { ChartCard } from "@/components/ChartCard";
import type { Chart } from "@/components/ChartCard";
import { HeaderBar } from "@/components/HeaderBar";
import { DevicesCard, CustomEventTiles } from "@/components/BreakdownCards";
import { buildOverviewCsv, formatHeaderRangeLabel } from "@/lib/header";
import { DataTableCard } from "@/components/DataTableCard";
import type { DataTableRow } from "@/components/DataTableCard";
import {
  buildRowFilterHref,
  buildEventDetailFilterHref,
  isActiveRowFilter,
  isActiveEventDetailFilter,
  buildFilterChip,
} from "@/lib/filter-ui";
import { isDayPeriod, currentMonth, currentDay, isHourPeriod, currentHour, shiftMonth, shiftDay, shiftHour } from "@/lib/months";

/**
 * Server Component - fetches DynamoDB directly, server-side. No client-side
 * fetch to a self-hosted API route: since this already runs on the server,
 * adding an HTTP round trip to our own API would be pure overhead. AWS
 * credentials never leave the server either way.
 *
 * Combines two sources into one summary: the permanent AGG# rollups (past
 * complete hours) plus a live-computed pseudo-rollup for the current,
 * still-incomplete hour (raw events, aggregated on the fly). See
 * docs/design.md and the "how does Simple Analytics show data instantly"
 * discussion this was built to answer - the live path exists specifically
 * to close that gap without giving up the free-tier-friendly rollup design
 * for historical data.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    siteId?: string;
    month?: string;
    path?: string;
    referrer?: string;
    country?: string;
    device?: string;
    eventName?: string;
    eventKey?: string;
    eventValue?: string;
  }>;
}) {
  const params = await searchParams;
  // Registered sites are the normal case. An unregistered siteId still renders
  // (its data exists in DynamoDB) but is flagged below; the default is the
  // portfolio, the site with the most traffic.
  const requestedSiteId = params.siteId?.trim() || DEFAULT_SITE_ID;
  const site = getSite(requestedSiteId);
  const siteId = site ? site.siteId : requestedSiteId;
  const filters = parseFilters(params);
  // Month scoping and dimension filtering are two independent axes today -
  // if a dimension filter is active it takes over entirely (its own
  // raw-event-based ~30-day window, see below), same as before this feature
  // existed. Not composed together in this pass.
  //
  // `?month=` holds a month ("2026-08"), a day ("2026-08-15"), or an hour
  // ("2026-08-15T14") - each is always inside exactly one of the coarser
  // ones, so it reuses the same param rather than needing a third one;
  // `isDayPeriod`/`isHourPeriod` tell them apart.
  const selectedPeriod = params.month?.trim() || undefined;
  const isDay = selectedPeriod ? isDayPeriod(selectedPeriod) : false;
  const isHour = selectedPeriod ? isHourPeriod(selectedPeriod) : false;

  // Rollups + live events are always fetched: the unfiltered summary is the
  // default view AND the source of the filter dropdown options.
  // `selectedPeriod` narrows the AGG# query to one month, day, or hour via
  // the existing SK prefix shape (undefined = today's unbounded all-time
  // query).
  //
  // Period-over-period comparison: only meaningful when a period is
  // actually selected (no single "previous period" exists for the
  // unbounded "all time" root - inventing one, e.g. trailing-30-vs-
  // previous-30, would silently redefine what "all time" pageviews means
  // elsewhere in the app) and only when not dimension-filtered (filtering
  // bypasses selectedPeriod's scoping entirely, see lib/filter.ts, so
  // there's no coherent "previous period" for it either). Fetched
  // unconditionally alongside the rest - `getHourlyRollups` on an
  // out-of-range/empty period just returns [], which computePeriodComparison
  // already treats as "no previous data" (renders as "new", not a bogus 0%).
  const previousPeriod = !selectedPeriod
    ? undefined
    : isHour
      ? shiftHour(selectedPeriod, -1)
      : isDay
        ? shiftDay(selectedPeriod, -1)
        : shiftMonth(selectedPeriod, -1);
  const [rollups, liveEvents, sessions, previousRollups] = await Promise.all([
    getHourlyRollups(siteId, selectedPeriod),
    getLiveRawEvents(siteId),
    getSessionRecordings(siteId),
    previousPeriod && !hasActiveFilter(filters) ? getHourlyRollups(siteId, previousPeriod) : Promise.resolve([]),
  ]);
  const sessionsSummary = summarizeSessions(sessions);
  const liveRollup = { SK: currentHourSK(), ...aggregateEvents(liveEvents) };
  // The live current-hour data only belongs in the summary when the viewed
  // range actually includes "now" - the all-time view always does, a past
  // period never does, the current month/day/hour does.
  const includesNow =
    !selectedPeriod ||
    (isHour ? selectedPeriod === currentHour() : isDay ? selectedPeriod === currentDay() : selectedPeriod === currentMonth());
  const rollupsWithLive = includesNow ? [...rollups, liveRollup] : rollups;

  // When a dimension filter is active, the AGG# rollups can't answer it (they
  // store per-hour counts within each dimension, not cross-dimension slices) -
  // recompute from raw events instead. See lib/filter.ts for why this covers
  // only the trailing ~30 days.
  let summary: DashboardSummary;
  let monthlyTrend: MonthlyTrendPoint[] | null = null;
  let dailyTrend: DailyTrendPoint[] | null = null;
  if (hasActiveFilter(filters)) {
    const rawEvents = await getAllRawEvents(siteId);
    summary = summarizeRollups(buildFilteredRollups(rawEvents, filters));
  } else {
    summary = summarizeRollups(rollupsWithLive);
    if (!selectedPeriod) {
      // All-time view: trend across months - a single period already IS one
      // month/day, nothing above it to trend.
      monthlyTrend = summarizeMonthlyTrend(rollupsWithLive);
    } else if (!isDay && !isHour) {
      // Viewing one month: break it down into its days, each a link deeper.
      dailyTrend = summarizeDailyTrend(rollupsWithLive);
    }
    // Viewing one day or one hour: no trend below it either - the day case
    // already has TimeSeriesChart as its own hourly breakdown, and an hour
    // is the finest granularity there is.
  }
  const filtered = hasActiveFilter(filters);

  const comparison: PeriodComparison | undefined =
    selectedPeriod && !filtered ? computePeriodComparison(summary, summarizeRollups(previousRollups)) : undefined;
  const previousSummary = selectedPeriod && !filtered ? summarizeRollups(previousRollups) : null;

  // Exactly one chart per drill depth (root→monthly, month→daily,
  // day→hourly; hour is the finest granularity, no chart below it). When a
  // dimension filter is active, selectedPeriod's scoping is bypassed
  // entirely (see lib/filter.ts) - show the hourly breakdown of the filtered
  // raw events instead, with no breadcrumb/period-nav (it'd be stale).
  const chart: Chart = filtered
    ? isHour
      ? null
      : { kind: "hourly", data: summary.timeSeries }
    : !selectedPeriod
      ? monthlyTrend
        ? { kind: "monthly", data: monthlyTrend }
        : null
      : !isDay && !isHour
        ? dailyTrend
          ? { kind: "daily", data: dailyTrend }
          : null
        : isDay
          ? { kind: "hourly", data: summary.timeSeries }
          : null;

  // AI insights are optional and best-effort: skip the call entirely for an
  // empty view (nothing to say), and swallow any failure (GEMINI_API_KEY
  // unset, Gemini quota/network error) so a broken AI layer never breaks the
  // rest of the dashboard - see docs/decisions.md.
  //
  // Cached (stale-while-revalidate on Vercel) rather than called fresh on
  // every render: this box fires unconditionally on every page load, which
  // burns through Gemini's free-tier 5-requests/minute cap in a couple of
  // reloads. Keyed on siteId + period + filter state, NOT on summary's or
  // sessionsSummary's content - unstable_cache's key comes from keyParts
  // plus the wrapped function's own arguments (none here; both summaries
  // are closed over), so minor data drift within the revalidate window
  // intentionally does not bust the cache. 1 hour matches the rollup
  // Lambda's own EventBridge cadence (see
  // packages/ingestion/infra/lib/lantern-stack.ts) - insights can't be
  // meaningfully fresher than the data they're summarizing anyway.
  // sessionsSummary is passed alongside summary - it's all-time (see
  // summarizeSessions's comment), not scoped to selectedPeriod/filters like
  // summary is, but it's still real signal worth folding in regardless of
  // which period is being viewed.
  let insights: Insight[] | null = null;
  if (summary.totalPageviews > 0) {
    try {
      const getCachedInsights = unstable_cache(
        async () => getInsights(summary, sessionsSummary),
        ["ai-insights", siteId, selectedPeriod ?? "all-time", String(filtered)],
        { revalidate: 3600 },
      );
      insights = (await getCachedInsights()).insights;
    } catch (err) {
      console.error("dashboard: getInsights failed", err);
    }
  }

  const topPageRows: DataTableRow[] = summary.topPages.map((p) => ({
    key: p.path || "(empty)",
    count: p.count,
    href: buildRowFilterHref(siteId, "path", p.path),
    active: isActiveRowFilter(filters, "path", p.path),
  }));
  const referrerRows: DataTableRow[] = summary.referrers.map((r) => ({
    key: r.referrer || "(empty)",
    count: r.count,
    href: buildRowFilterHref(siteId, "referrer", r.referrer),
    active: isActiveRowFilter(filters, "referrer", r.referrer),
  }));
  const countryRows: DataTableRow[] = summary.countries.map((c) => ({
    key: c.country || "(empty)",
    count: c.count,
    href: buildRowFilterHref(siteId, "country", c.country),
    active: isActiveRowFilter(filters, "country", c.country),
    renderKey: () => <CountryLabel code={c.country} />,
  }));
  const customEventDetailRows: DataTableRow[] = summary.customEventBreakdown.map((b) => ({
    key: `${b.name} · ${b.dimension}: ${b.value}`,
    count: b.count,
    href: buildEventDetailFilterHref(siteId, b.name, b.dimension, b.value),
    active: isActiveEventDetailFilter(filters, b.name, b.dimension, b.value),
  }));

  return (
    <AppShell
      siteId={siteId}
      siteUrl={site?.url}
      activeView="overview"
      basePath="/"
      filterChip={filtered ? buildFilterChip(siteId, filters) : undefined}
      liveCount={!filtered ? liveEvents.length : 0}
      header={
        <HeaderBar
          siteId={siteId}
          siteName={site ? site.name : siteId}
          siteUrl={site?.url}
          liveVisitors={!filtered ? liveRollup.uniques : 0}
          selectedPeriod={selectedPeriod}
          isDay={isDay}
          isHour={isHour}
          searchDefault={filters.path}
          overviewCsv={buildOverviewCsv({
            periodLabel: formatHeaderRangeLabel(selectedPeriod, isDay, isHour),
            pageviews: summary.totalPageviews,
            uniques: summary.totalUniques,
            topPages: summary.topPages.map((p) => ({ path: p.path, count: p.count })),
            referrers: summary.referrers.map((r) => ({ referrer: r.referrer, count: r.count })),
            countries: summary.countries.map((c) => ({ country: c.country, count: c.count })),
          })}
          csvFilename={`${siteId}-overview-${selectedPeriod ?? "all-time"}.csv`}
        />
      }
    >

      {filtered && (
        <p style={{ color: theme.color.amber, fontSize: "0.85rem", margin: "0 0 1rem" }}>
          Filtered view - recomputed from raw events, so it covers the trailing ~30 days (the raw-event TTL)
          rather than full history.
        </p>
      )}

      <ChartCard
        siteId={siteId}
        pageviews={summary.totalPageviews}
        uniques={summary.totalUniques}
        pageviewsDelta={comparison?.pageviewsDeltaPercent}
        uniquesDelta={comparison?.uniquesDeltaPercent}
        previousPageviews={previousSummary?.totalPageviews}
        sessionsSummary={sessionsSummary}
        selectedPeriod={selectedPeriod}
        isDay={isDay}
        isHour={isHour}
        showPeriodNav={!filtered}
        chart={chart}
      />

      <div className="lantern-grid-8-4" style={{ marginBottom: "1.25rem" }}>
        {insights ? <InsightsBox insights={insights} /> : <div style={{ ...card }}><p style={{ color: theme.color.textFaint, fontSize: "0.82rem", margin: 0 }}>No insights yet - not enough data.</p></div>}
        {filtered ? (
          <div style={{ ...card }}>
            <p style={{ color: theme.color.textMuted, fontSize: "0.8rem", margin: 0 }}>Clear the active filter to ask a question about this exact view.</p>
          </div>
        ) : (
          <AiQueryBox siteId={siteId} monthPrefix={selectedPeriod} />
        )}
      </div>

      <div className="lantern-grid-3">
        <DataTableCard
          title="Top pages"
          icon="fa-regular fa-folder"
          rows={topPageRows}
          initialVisibleCount={10}
          exportFilename={`${siteId}-top-pages.csv`}
          footnote={
            summary.topPages.length <= 2
              ? "Single-page architecture detected. Deep-link sections are tracked via Custom Events below."
              : undefined
          }
        />
        <DataTableCard title="Referrers" icon="fa-solid fa-arrow-turn-down" rows={referrerRows} initialVisibleCount={10} exportFilename={`${siteId}-referrers.csv`} />
        <DataTableCard
          title="Countries"
          icon="fa-solid fa-earth-americas"
          rows={countryRows}
          initialVisibleCount={10}
          exportFilename={`${siteId}-countries.csv`}
          searchAlways
          searchPlaceholder="Search country..."
          listMaxHeight="13rem"
        />
      </div>

      <div className="lantern-grid-1-2" style={{ marginTop: "1rem" }}>
        <DevicesCard devices={summary.devices} periodLabel={formatHeaderRangeLabel(selectedPeriod, isDay, isHour)} />
        <CustomEventTiles events={summary.customEvents} exportFilename={`${siteId}-custom-events.csv`} />
      </div>

      <div style={{ marginTop: "1rem" }}>
        <DataTableCard
          title="Custom Event Details"
          subtitle="Deep telemetry tags captured via client SDK"
          icon="fa-solid fa-list-check"
          rows={customEventDetailRows}
          initialVisibleCount={10}
          exportFilename={`${siteId}-custom-event-details.csv`}
        />
      </div>
    </AppShell>
  );
}

/**
 * Server-rendered, no client JS - see docs/design.md's Phase 3 section.
 * `insights` is already-generated observation+action pairs from
 * getInsights(); this component only lays them out.
 */
function InsightsBox({ insights }: { insights: Insight[] }) {
  return (
    <div
      style={{
        ...card,
        marginBottom: "1.5rem",
        background: `linear-gradient(135deg, ${theme.color.brandTintBg}, ${theme.color.cardBg} 55%, ${theme.color.bg})`,
        border: `1px solid ${theme.color.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          paddingBottom: "0.75rem",
          borderBottom: `1px solid ${theme.color.border}`,
          marginBottom: "0.875rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: theme.radius.small,
              background: theme.color.brand,
              color: theme.color.onBrand,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
            }}
          >
            <i className="fa-solid fa-wand-magic-sparkles" />
          </span>
          <div style={{ fontWeight: theme.font.weight.bold, fontSize: "0.875rem" }}>Insights & Recommendations</div>
          <div
            style={{
              fontSize: "0.625rem",
              fontFamily: theme.font.mono,
              fontWeight: theme.font.weight.semibold,
              color: theme.color.brandTintTextStrong,
              background: theme.color.brandTintBg,
              border: `1px solid ${theme.color.border}`,
              padding: "0.125rem 0.5rem",
              borderRadius: theme.radius.pill,
            }}
          >
            AI Automated
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {insights.map((insight, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: "0.75rem",
              alignItems: "flex-start",
              background: theme.color.cardBg,
              border: `1px solid ${theme.color.cardBorder}`,
              padding: "0.625rem",
              borderRadius: theme.radius.control,
            }}
          >
            {insight.category && (
              <span
                style={{
                  flexShrink: 0,
                  marginTop: "0.125rem",
                  fontSize: "0.625rem",
                  fontWeight: theme.font.weight.bold,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: theme.color.textMuted,
                  background: theme.color.bg,
                  border: `1px solid ${theme.color.border}`,
                  padding: "0.125rem 0.5rem",
                  borderRadius: theme.radius.small,
                  whiteSpace: "nowrap",
                }}
              >
                {insight.category}
              </span>
            )}
            <div style={{ minWidth: 0, fontSize: "0.75rem", lineHeight: 1.6, color: theme.color.text }}>
              <div>{insight.observation}</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginTop: "0.25rem",
                  fontSize: "0.6875rem",
                  fontWeight: theme.font.weight.medium,
                  color: theme.color.brandTintTextStrong,
                }}
              >
                <i className="fa-solid fa-arrow-right" style={{ fontSize: "0.625rem" }} />
                <span>{insight.action}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Country flag from FlagCDN, keyed by ISO 3166-1 alpha-2 (lowercase). */
function CountryLabel({ code }: { code: string }) {
  if (!code || code.length !== 2) return <>{code || "(empty)"}</>;
  const flag = `https://flagcdn.com/w20/${code.toLowerCase()}.png`;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
      <img src={flag} alt={`${code} flag`} width={16} height={12} loading="lazy" style={{ borderRadius: 2 }} />
      {code}
    </span>
  );
}
