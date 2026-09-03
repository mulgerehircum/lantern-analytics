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
 * The Overview page's stats + drill-down chart card — combines the
 * Pageviews/Uniques numbers, the live-data badge, a breadcrumb trail (which
 * level is a link "up") plus a secondary prev/next affordance, and exactly
 * one bar chart matching the current drill depth.
 */
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
  /** Hidden entirely when a dimension filter is active — selectedPeriod's
   *  scoping is bypassed during filtering (see lib/filter.ts), so a
   *  breadcrumb tied to it would be misleading rather than just stale. */
  showPeriodNav?: boolean;
  /** vs. the immediately preceding equivalent period — undefined at "all
   *  time" root (no natural single previous period) or while filtered. */
  comparison?: PeriodComparison;
  chart: Chart;
}) {
  return (
    <div style={{ ...card, marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "2.5rem" }}>
          <Stat label="Pageviews" value={pageviews} deltaPercent={comparison?.pageviewsDeltaPercent} />
          <Stat label="Uniques (approx.)" value={uniques} deltaPercent={comparison?.uniquesDeltaPercent} />
        </div>
        {liveCount > 0 && (
          <div style={{ fontSize: "0.8rem", color: theme.color.brand, textAlign: "right" }}>
            🌿 {liveCount} live
            <br />
            not rolled up yet
          </div>
        )}
      </div>

      {showPeriodNav && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
          <Breadcrumb siteId={siteId} selectedPeriod={selectedPeriod} isDay={isDay} isHour={isHour} />
          {isHour ? (
            <HourNav siteId={siteId} hour={selectedPeriod!} />
          ) : isDay ? (
            <DayNav siteId={siteId} day={selectedPeriod!} />
          ) : selectedPeriod ? (
            <MonthNav siteId={siteId} month={selectedPeriod} />
          ) : null}
        </div>
      )}

      {chart?.kind === "monthly" && <MonthlyTrendChart siteId={siteId} data={chart.data} />}
      {chart?.kind === "daily" && <DailyTrendChart siteId={siteId} data={chart.data} />}
      {chart?.kind === "hourly" && <TimeSeriesChart siteId={siteId} data={chart.data} />}
    </div>
  );
}

function Stat({ label, value, deltaPercent }: { label: string; value: number; deltaPercent?: number | null }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem" }}>
        <div style={{ fontSize: "2rem", fontWeight: theme.font.weight.bold }}>{value}</div>
        {deltaPercent !== undefined && <DeltaBadge deltaPercent={deltaPercent} />}
      </div>
      <div style={{ fontSize: "0.78rem", color: theme.color.textMuted }}>{label}</div>
    </div>
  );
}

/** null (previous period was 0) renders as "new" rather than a nonsensical %. */
function DeltaBadge({ deltaPercent }: { deltaPercent: number | null }) {
  if (deltaPercent === null) {
    return <span style={{ fontSize: "0.75rem", color: theme.color.textMuted }}>new</span>;
  }
  const up = deltaPercent >= 0;
  return (
    <span style={{ fontSize: "0.75rem", fontWeight: theme.font.weight.semibold, color: up ? theme.color.brand : theme.color.amber }}>
      {up ? "+" : ""}
      {deltaPercent}%
    </span>
  );
}
