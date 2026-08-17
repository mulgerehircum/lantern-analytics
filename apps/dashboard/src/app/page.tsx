import { unstable_cache } from "next/cache";
import { aggregateEvents } from "@/lib/aggregate";
import { getHourlyRollups, getLiveRawEvents, getAllRawEvents, currentHourSK } from "@/lib/dynamodb";
import { getSessionRecordings } from "@/lib/sessions";
import { getInsights } from "@/lib/ai-query";
import type { Insight } from "@/lib/ai-query";
import { summarizeRollups, summarizeMonthlyTrend, summarizeDailyTrend, summarizeSessions } from "@/lib/summarize";
import type { DashboardSummary, MonthlyTrendPoint, DailyTrendPoint } from "@/lib/summarize";
import { buildFilteredRollups, hasActiveFilter, parseFilters } from "@/lib/filter";
import type { DashboardFilters } from "@/lib/filter";
import { DEFAULT_SITE_ID, getSite } from "@/lib/sites";
import { ProjectSelector, fieldStyle } from "@/components/ProjectSelector";
import { HourBar } from "@/components/HourBar";
import { HourNav } from "@/components/HourNav";
import {
  currentMonth,
  shiftMonth,
  formatMonthLabel,
  isDayPeriod,
  parentMonth,
  currentDay,
  shiftDay,
  formatDayLabel,
  isHourPeriod,
  currentHour,
} from "@/lib/months";

/**
 * Server Component — fetches DynamoDB directly, server-side. No client-side
 * fetch to a self-hosted API route: since this already runs on the server,
 * adding an HTTP round trip to our own API would be pure overhead. AWS
 * credentials never leave the server either way.
 *
 * Combines two sources into one summary: the permanent AGG# rollups (past
 * complete hours) plus a live-computed pseudo-rollup for the current,
 * still-incomplete hour (raw events, aggregated on the fly). See
 * docs/design.md and the "how does Simple Analytics show data instantly"
 * discussion this was built to answer — the live path exists specifically
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
  // Month scoping and dimension filtering are two independent axes today —
  // if a dimension filter is active it takes over entirely (its own
  // raw-event-based ~30-day window, see below), same as before this feature
  // existed. Not composed together in this pass.
  //
  // `?month=` holds a month ("2026-08"), a day ("2026-08-15"), or an hour
  // ("2026-08-15T14") — each is always inside exactly one of the coarser
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
  const [rollups, liveEvents, sessions] = await Promise.all([
    getHourlyRollups(siteId, selectedPeriod),
    getLiveRawEvents(siteId),
    getSessionRecordings(siteId),
  ]);
  const sessionsSummary = summarizeSessions(sessions);
  const liveRollup = { SK: currentHourSK(), ...aggregateEvents(liveEvents) };
  // The live current-hour data only belongs in the summary when the viewed
  // range actually includes "now" — the all-time view always does, a past
  // period never does, the current month/day/hour does.
  const includesNow =
    !selectedPeriod ||
    (isHour ? selectedPeriod === currentHour() : isDay ? selectedPeriod === currentDay() : selectedPeriod === currentMonth());
  const rollupsWithLive = includesNow ? [...rollups, liveRollup] : rollups;

  // When a dimension filter is active, the AGG# rollups can't answer it (they
  // store per-hour counts within each dimension, not cross-dimension slices) —
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
      // All-time view: trend across months — a single period already IS one
      // month/day, nothing above it to trend.
      monthlyTrend = summarizeMonthlyTrend(rollupsWithLive);
    } else if (!isDay && !isHour) {
      // Viewing one month: break it down into its days, each a link deeper.
      dailyTrend = summarizeDailyTrend(rollupsWithLive);
    }
    // Viewing one day or one hour: no trend below it either — the day case
    // already has TimeSeriesChart as its own hourly breakdown, and an hour
    // is the finest granularity there is.
  }
  const filtered = hasActiveFilter(filters);

  // AI insights are optional and best-effort: skip the call entirely for an
  // empty view (nothing to say), and swallow any failure (GEMINI_API_KEY
  // unset, Gemini quota/network error) so a broken AI layer never breaks the
  // rest of the dashboard — see docs/decisions.md.
  //
  // Cached (stale-while-revalidate on Vercel) rather than called fresh on
  // every render: this box fires unconditionally on every page load, which
  // burns through Gemini's free-tier 5-requests/minute cap in a couple of
  // reloads. Keyed on siteId + period + filter state, NOT on summary's or
  // sessionsSummary's content — unstable_cache's key comes from keyParts
  // plus the wrapped function's own arguments (none here; both summaries
  // are closed over), so minor data drift within the revalidate window
  // intentionally does not bust the cache. 1 hour matches the rollup
  // Lambda's own EventBridge cadence (see
  // packages/ingestion/infra/lib/lantern-stack.ts) — insights can't be
  // meaningfully fresher than the data they're summarizing anyway.
  // sessionsSummary is passed alongside summary — it's all-time (see
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

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
      <ProjectSelector siteId={siteId} siteUrl={site?.url} />
      <h1 style={{ margin: "0.25rem 0 0" }}>
        Lantern Analytics — {site ? site.name : siteId}
        {site ? (
          <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "#666" }}>
            {" "}
            <a href={site.url} target="_blank" rel="noreferrer">
              (live)
            </a>
          </span>
        ) : (
          <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "#b45309" }}> — not in site registry</span>
        )}
        {" · "}
        <a href={`/sessions?siteId=${encodeURIComponent(siteId)}`} style={{ fontSize: "0.85rem", fontWeight: 400, color: "#4f46e5" }}>
          Sessions
        </a>
      </h1>
      {!filtered && liveEvents.length > 0 && (
        <p style={{ color: "#4f46e5", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
          Includes {liveEvents.length} live event{liveEvents.length === 1 ? "" : "s"} from the current
          hour, not yet permanently rolled up.
        </p>
      )}
      {filtered && (
        <p style={{ color: "#b45309", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
          Filtered view — recomputed from raw events, so it covers the trailing ~30 days (the
          raw-event TTL) rather than full history.
        </p>
      )}
      {!filtered && selectedPeriod && (
        isHour ? <HourNav siteId={siteId} hour={selectedPeriod} /> :
        isDay ? <DayNav siteId={siteId} day={selectedPeriod} /> :
        <MonthNav siteId={siteId} month={selectedPeriod} />
      )}

      <FilterBar siteId={siteId} filters={filters} summary={summary} />

      <section style={{ display: "flex", gap: "2rem", margin: "1.5rem 0" }}>
        <Stat label="Pageviews" value={summary.totalPageviews} />
        <Stat label="Uniques (approx.)" value={summary.totalUniques} />
      </section>

      {insights && <InsightsBox insights={insights} />}

      {monthlyTrend && (
        <>
          <p style={{ fontSize: "0.75rem", color: "#555", margin: "0 0 0.25rem" }}>Monthly trend</p>
          <MonthlyTrendChart siteId={siteId} data={monthlyTrend} />
        </>
      )}
      {dailyTrend && (
        <>
          <p style={{ fontSize: "0.75rem", color: "#555", margin: "0 0 0.25rem" }}>
            Days in {formatMonthLabel(selectedPeriod!)}
          </p>
          <DailyTrendChart siteId={siteId} data={dailyTrend} />
        </>
      )}

      {!isHour && <TimeSeriesChart siteId={siteId} data={summary.timeSeries} />}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginTop: "2rem" }}>
        <Table title="Top pages" rows={summary.topPages.map((p) => [p.path, p.count] as const)} />
        <Table title="Referrers" rows={summary.referrers.map((r) => [r.referrer, r.count] as const)} />
        <Table
          title="Countries"
          rows={summary.countries.map((c) => [c.country, c.count] as const)}
          renderKey={(code) => <CountryLabel code={code} />}
        />
        <Table title="Devices" rows={summary.devices.map((d) => [d.device, d.count] as const)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginTop: "2rem" }}>
        <Table title="Custom events" rows={summary.customEvents.map((e) => [e.name, e.count] as const)} />
        <Table
          title="Custom event details"
          rows={summary.customEventBreakdown.map((b) => [`${b.name} · ${b.dimension}: ${b.value}`, b.count] as const)}
        />
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: "2rem", fontWeight: 700 }}>{value}</div>
      <div style={{ color: "#666" }}>{label}</div>
    </div>
  );
}

/**
 * Server-rendered, no client JS — see docs/design.md's Phase 3 section.
 * `insights` is already-generated observation+action pairs from
 * getInsights(); this component only lays them out.
 */
function InsightsBox({ insights }: { insights: Insight[] }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: "1rem",
        margin: "0 0 1.5rem",
        background: "#f8f7ff",
      }}
    >
      <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "#4f46e5" }}>AI Insights</h3>
      <ul style={{ margin: 0, paddingLeft: "1.25rem", listStyle: "none" }}>
        {insights.map((insight, i) => (
          <li key={i} style={{ marginBottom: "0.75rem" }}>
            <div>{insight.observation}</div>
            <div style={{ color: "#4f46e5", fontSize: "0.85rem", marginTop: 2 }}>→ {insight.action}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Dimension filters. A plain GET form — no client JS, consistent with the
 * page's server-component design. Options are built from the unfiltered
 * summary so the dropdowns always show values that actually exist in the data.
 */
function FilterBar({
  siteId,
  filters,
  summary,
}: {
  siteId: string;
  filters: DashboardFilters;
  summary: DashboardSummary;
}) {
  return (
    <form
      method="GET"
      style={{
        display: "flex",
        gap: "0.5rem",
        alignItems: "flex-end",
        flexWrap: "wrap",
        margin: "1rem 0",
        padding: "0.75rem",
        border: "1px solid #ddd",
        borderRadius: 8,
      }}
    >
      <input type="hidden" name="siteId" value={siteId} />
      <label style={{ fontSize: "0.75rem", color: "#555" }}>
        Path
        <br />
        <input type="text" name="path" defaultValue={filters.path} placeholder="e.g. /proj" style={fieldStyle} />
      </label>
      <label style={{ fontSize: "0.75rem", color: "#555" }}>
        Referrer
        <br />
        <select name="referrer" defaultValue={filters.referrer ?? ""} style={fieldStyle}>
          <option value="">All</option>
          {summary.referrers.map((r) => (
            <option key={r.referrer} value={r.referrer}>
              {r.referrer}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: "0.75rem", color: "#555" }}>
        Country
        <br />
        <select name="country" defaultValue={filters.country ?? ""} style={fieldStyle}>
          <option value="">All</option>
          {summary.countries.map((c) => (
            <option key={c.country} value={c.country}>
              {c.country}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: "0.75rem", color: "#555" }}>
        Device
        <br />
        <select name="device" defaultValue={filters.device ?? ""} style={fieldStyle}>
          <option value="">All</option>
          {summary.devices.map((d) => (
            <option key={d.device} value={d.device}>
              {d.device}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: "0.75rem", color: "#555" }}>
        Event name
        <br />
        <select name="eventName" defaultValue={filters.eventName ?? ""} style={fieldStyle}>
          <option value="">All</option>
          {summary.customEvents.map((e) => (
            <option key={e.name} value={e.name}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: "0.75rem", color: "#555" }}>
        Event key
        <br />
        <select name="eventKey" defaultValue={filters.eventKey ?? ""} style={fieldStyle}>
          <option value="">Any</option>
          {[...new Set(summary.customEventBreakdown.map((b) => b.dimension))].map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: "0.75rem", color: "#555" }}>
        Event value
        <br />
        <select name="eventValue" defaultValue={filters.eventValue ?? ""} style={fieldStyle}>
          <option value="">Any</option>
          {[...new Set(summary.customEventBreakdown.map((b) => b.value))].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" style={{ ...fieldStyle, cursor: "pointer", background: "#4f46e5", color: "#fff", border: "none" }}>
        Filter
      </button>
      {hasActiveFilter(filters) && (
        <a href={`/?siteId=${encodeURIComponent(siteId)}`} style={{ fontSize: "0.85rem", color: "#4f46e5" }}>
          Clear
        </a>
      )}
    </form>
  );
}

function Table({
  title,
  rows,
  renderKey,
}: {
  title: string;
  rows: ReadonlyArray<readonly [string, number]>;
  renderKey?: (key: string) => React.ReactNode;
}) {
  return (
    <div>
      <h3>{title}</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td style={{ color: "#999" }}>No data yet</td>
            </tr>
          )}
          {rows.map(([key, count]) => (
            <tr key={key || "(empty)"}>
              <td style={{ padding: "4px 0" }}>{renderKey ? renderKey(key) : key || "(empty)"}</td>
              <td style={{ padding: "4px 0", textAlign: "right" }}>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Country flag from FlagCDN, keyed by ISO 3166-1 alpha-2 (lowercase). */
function CountryLabel({ code }: { code: string }) {
  if (!code || code.length !== 2) return <>{code || "(empty)"}</>;
  const flag = `https://flagcdn.com/w20/${code.toLowerCase()}.png`;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
      <img src={flag} alt={`${code} flag`} width={20} height={15} loading="lazy" style={{ borderRadius: 2 }} />
      {code}
    </span>
  );
}

/** Dependency-free bar chart — no charting library for something this simple. */
function TimeSeriesChart({ siteId, data }: { siteId: string; data: Array<{ hour: string; pageviews: number }> }) {
  if (data.length === 0) return <p style={{ color: "#999" }}>No data yet</p>;
  const max = Math.max(...data.map((d) => d.pageviews), 1);
  const BAR_AREA_PX = 120;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120, borderBottom: "1px solid #ddd" }}>
      {data.map((d) => (
        <HourBar
          key={d.hour}
          hour={d.hour}
          pageviews={d.pageviews}
          heightPx={Math.round((d.pageviews / max) * BAR_AREA_PX)}
          // Every bar corresponds to exactly one real hour regardless of the
          // current zoom level (all-time/month/day) — d.hour is already a
          // full ISO timestamp; slice(0, 13) gives the "YYYY-MM-DDTHH" shape
          // the `?month=` param expects for an hour (see months.ts).
          href={`/?siteId=${encodeURIComponent(siteId)}&month=${d.hour.slice(0, 13)}`}
        />
      ))}
    </div>
  );
}

/**
 * One bar per month, each a plain link into that month's drill-down view —
 * no client JS, matches the rest of the page's no-JS-needed philosophy.
 */
function MonthlyTrendChart({ siteId, data }: { siteId: string; data: MonthlyTrendPoint[] }) {
  if (data.length === 0) return <p style={{ color: "#999" }}>No data yet</p>;
  const max = Math.max(...data.map((d) => d.pageviews), 1);
  // Pixel height, not a CSS percentage: the bar's direct parent is now the
  // <a> (added so the whole bar+label is one click target), which has no
  // explicit height of its own — a `%` height resolves against that
  // undefined height and collapses to ~0. A pixel value has no such
  // dependency; alignItems: "flex-end" on the row below still lines every
  // bar+label up along the same baseline regardless of height.
  const BAR_AREA_PX = 90;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, borderBottom: "1px solid #ddd", marginBottom: "0.5rem" }}>
      {data.map((d) => (
        <a
          key={d.month}
          href={`/?siteId=${encodeURIComponent(siteId)}&month=${encodeURIComponent(d.month)}`}
          title={`${formatMonthLabel(d.month)}: ${d.pageviews} pageviews`}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 32, textDecoration: "none" }}
        >
          <div
            style={{
              width: 20,
              height: Math.max(Math.round((d.pageviews / max) * BAR_AREA_PX), d.pageviews > 0 ? 2 : 0),
              background: "#4f46e5",
              borderRadius: "2px 2px 0 0",
            }}
          />
          <span style={{ fontSize: "0.65rem", color: "#666", marginTop: 4 }}>{d.month.slice(5)}</span>
        </a>
      ))}
    </div>
  );
}

/** Prev/next month navigation for the single-month drill-down view. */
function MonthNav({ siteId, month }: { siteId: string; month: string }) {
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  return (
    <p style={{ fontSize: "0.85rem", margin: "0.25rem 0 0", display: "flex", gap: "0.75rem", alignItems: "center" }}>
      <a href={`/?siteId=${encodeURIComponent(siteId)}&month=${prev}`} style={{ color: "#4f46e5" }}>
        ← {formatMonthLabel(prev)}
      </a>
      <strong>{formatMonthLabel(month)}</strong>
      <a href={`/?siteId=${encodeURIComponent(siteId)}&month=${next}`} style={{ color: "#4f46e5" }}>
        {formatMonthLabel(next)} →
      </a>
      <a href={`/?siteId=${encodeURIComponent(siteId)}`} style={{ color: "#666" }}>
        (all time)
      </a>
    </p>
  );
}

/**
 * One bar per day within the currently-viewed month, each a plain link into
 * that day's drill-down view — same no-client-JS pattern as MonthlyTrendChart.
 */
function DailyTrendChart({ siteId, data }: { siteId: string; data: DailyTrendPoint[] }) {
  if (data.length === 0) return <p style={{ color: "#999" }}>No data yet</p>;
  const max = Math.max(...data.map((d) => d.pageviews), 1);
  // Pixel height, not a CSS percentage — see MonthlyTrendChart's comment for why.
  const BAR_AREA_PX = 90;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120, borderBottom: "1px solid #ddd", marginBottom: "0.5rem" }}>
      {data.map((d) => (
        <a
          key={d.day}
          href={`/?siteId=${encodeURIComponent(siteId)}&month=${encodeURIComponent(d.day)}`}
          title={`${formatDayLabel(d.day)}: ${d.pageviews} pageviews`}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, textDecoration: "none" }}
        >
          <div
            style={{
              width: 12,
              height: Math.max(Math.round((d.pageviews / max) * BAR_AREA_PX), d.pageviews > 0 ? 2 : 0),
              background: "#4f46e5",
              borderRadius: "2px 2px 0 0",
            }}
          />
          <span style={{ fontSize: "0.6rem", color: "#666", marginTop: 4 }}>{d.day.slice(8)}</span>
        </a>
      ))}
    </div>
  );
}

/**
 * Prev/next day navigation for the single-day drill-down view. Day is a
 * child of month (see the `?month=` param comment above), so "up" goes to
 * the day's own month rather than all time.
 */
function DayNav({ siteId, day }: { siteId: string; day: string }) {
  const prev = shiftDay(day, -1);
  const next = shiftDay(day, 1);
  return (
    <p style={{ fontSize: "0.85rem", margin: "0.25rem 0 0", display: "flex", gap: "0.75rem", alignItems: "center" }}>
      <a href={`/?siteId=${encodeURIComponent(siteId)}&month=${prev}`} style={{ color: "#4f46e5" }}>
        ← {formatDayLabel(prev)}
      </a>
      <strong>{formatDayLabel(day)}</strong>
      <a href={`/?siteId=${encodeURIComponent(siteId)}&month=${next}`} style={{ color: "#4f46e5" }}>
        {formatDayLabel(next)} →
      </a>
      <a href={`/?siteId=${encodeURIComponent(siteId)}&month=${parentMonth(day)}`} style={{ color: "#666" }}>
        (up to {formatMonthLabel(parentMonth(day))})
      </a>
    </p>
  );
}
