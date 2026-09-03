import { card, theme } from "@/lib/theme";
import type { DailyTrendPoint, MonthlyTrendPoint, PeriodComparison } from "@/lib/summarize";
import { Breadcrumb } from "./Breadcrumb";
import { DayNav, MonthNav } from "./PeriodNav";
import { HourNav } from "./HourNav";
import { DailyTrendChart, MonthlyTrendChart, TimeSeriesChart } from "./TrendCharts";

export type Chart =
  | { kind: "monthly"; data: MonthlyTrendPoint[] }
  | { kind: "daily"; data: DailyTrendPoint[] }
  | { kind: "hourly"; data: Array<{ hour: string; pageviews: number }> }
  | null;

/**
 * The Overview page's stats + drill-down chart card - combines the
 * Pageviews/Uniques numbers, the live-data badge, a breadcrumb trail (which
 * level is a link "up") plus a secondary prev/next affordance, and exactly
 * one bar chart matching the current drill depth.
 */
function formatRangeLabel(selectedPeriod: string | undefined, isDay: boolean, isHour: boolean): string {
  if (!selectedPeriod) return "All time";
  if (isHour) {
    const d = new Date(`${selectedPeriod}:00:00.000Z`);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + ` - ${selectedPeriod.split("T")[1]}:00`;
  }
  if (isDay) {
    const d = new Date(`${selectedPeriod}T00:00:00.000Z`);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  const [y, m] = selectedPeriod.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const s = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const e = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${s} - ${e}`;
}

function granularityLabel(chart: Chart, selectedPeriod: string | undefined, isDay: boolean, isHour: boolean): string {
  if (!selectedPeriod) return "Monthly";
  if (isHour) return "Hourly";
  if (isDay) return "Hourly";
  return "Daily";
}

export function ChartCard({
  siteId,
  pageviews,
  uniques,
  liveCount,
  selectedPeriod,
  isDay,
  isHour,
  showPeriodNav = true,
  comparison,
  chart,
}: {
  siteId: string;
  pageviews: number;
  uniques: number;
  liveCount: number;
  selectedPeriod?: string;
  isDay: boolean;
  isHour: boolean;
  /** Hidden entirely when a dimension filter is active - selectedPeriod's
   *  scoping is bypassed during filtering (see lib/filter.ts), so a
   *  breadcrumb tied to it would be misleading rather than just stale. */
  showPeriodNav?: boolean;
  /** vs. the immediately preceding equivalent period - undefined at "all
   *  time" root (no natural single previous period) or while filtered. */
  comparison?: PeriodComparison;
  chart: Chart;
}) {
  const granularity = granularityLabel(chart, selectedPeriod, isDay, isHour);
  const rangeLabel = formatRangeLabel(selectedPeriod, isDay, isHour);
  const hasLive = liveCount > 0;
  return (
    <div style={{ ...card, marginBottom: "1.5rem" }}>
      {/* Header: breadcrumb + live pill per spec */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem", flexWrap: "wrap", gap: "0.6rem" }}>
        {showPeriodNav ? (
          <Breadcrumb siteId={siteId} selectedPeriod={selectedPeriod} isDay={isDay} isHour={isHour} />
        ) : (
          <span style={{ fontSize: "0.78rem", color: theme.color.textMuted }}>Filtered view</span>
        )}
        {hasLive ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              background: theme.color.brandTintBg,
              color: theme.color.brandTintTextStrong,
              fontSize: "0.72rem",
              fontWeight: theme.font.weight.semibold,
              padding: "0.25rem 0.6rem",
              borderRadius: theme.radius.pill,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.color.brand, display: "inline-block" }} />
            {liveCount} visitors online
          </span>
        ) : null}
      </div>

      {showPeriodNav && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
          <div style={{ fontSize: "0.72rem", color: theme.color.textMuted }}>
            Granularity: {granularity} - {rangeLabel}
          </div>
          {isHour ? (
            <HourNav siteId={siteId} hour={selectedPeriod!} />
          ) : isDay ? (
            <DayNav siteId={siteId} day={selectedPeriod!} />
          ) : selectedPeriod ? (
            <MonthNav siteId={siteId} month={selectedPeriod} />
          ) : null}
        </div>
      )}

      {/* Legend per spec */}
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "0.6rem", fontSize: "0.72rem", color: theme.color.textMuted }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ width: 10, height: 10, background: theme.color.brand, borderRadius: 2, display: "inline-block" }} />
          Pageviews ({pageviews})
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ width: 10, height: 10, background: theme.color.textMuted, borderRadius: 2, display: "inline-block" }} />
          Uniques ({uniques})
        </span>
      </div>

      {/* Area fill container - vertical gradient from rgba(85,138,48,0.15) to transparent */}
      <div
        style={{
          background: "linear-gradient(to bottom, rgba(85,138,48,0.15), transparent)",
          borderRadius: theme.radius.small,
          padding: "0.6rem 0.4rem 0.2rem",
        }}
      >
        {chart?.kind === "monthly" && <MonthlyTrendChart siteId={siteId} data={chart.data} />}
        {chart?.kind === "daily" && <DailyTrendChart siteId={siteId} data={chart.data} />}
        {chart?.kind === "hourly" && <TimeSeriesChart siteId={siteId} data={chart.data} />}
        {!chart && <p style={{ color: theme.color.textFaint, fontSize: "0.82rem", margin: 0 }}>No data yet</p>}
      </div>
    </div>
  );
}
