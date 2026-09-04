import { card, theme } from "@/lib/theme";
import { formatDayLabel, formatMonthLabel } from "@/lib/months";
import { formatHeaderRangeLabel, formatMonthRangeShort, headerGranularityLabel } from "@/lib/header";
import type { DailyTrendPoint, MonthlyTrendPoint, SessionsSummary } from "@/lib/summarize";
import { Breadcrumb } from "./Breadcrumb";
import { MetricRow } from "./StatCards";
import { TrendAreaChart } from "./TrendAreaChart";
import type { TrendPoint } from "./TrendAreaChart";

export type Chart =
  | { kind: "monthly"; data: MonthlyTrendPoint[] }
  | { kind: "daily"; data: DailyTrendPoint[] }
  | { kind: "hourly"; data: Array<{ hour: string; pageviews: number; uniques: number }> }
  | null;

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The overview hero card - breadcrumb trail (which level is a link "up"),
 * the 4-KPI metric row, then one area chart matching the current drill
 * depth (root->monthly, month->daily, day->hourly; hour is the finest
 * granularity). Every chart point links one level deeper.
 */
export function ChartCard({
  siteId,
  pageviews,
  uniques,
  pageviewsDelta,
  uniquesDelta,
  previousPageviews,
  sessionsSummary,
  selectedPeriod,
  isDay,
  isHour,
  showPeriodNav = true,
  chart,
}: {
  siteId: string;
  pageviews: number;
  uniques: number;
  pageviewsDelta?: number | null;
  uniquesDelta?: number | null;
  previousPageviews?: number;
  sessionsSummary: SessionsSummary;
  selectedPeriod?: string;
  isDay: boolean;
  isHour: boolean;
  /** Hidden entirely when a dimension filter is active - selectedPeriod's
   *  scoping is bypassed during filtering (see lib/filter.ts), so a
   *  breadcrumb tied to it would be misleading rather than just stale. */
  showPeriodNav?: boolean;
  chart: Chart;
}) {
  const granularity = headerGranularityLabel(selectedPeriod, isDay, isHour);
  // The chart header uses the compact month form ("Sep 1 - Sep 30, 2026");
  // every other depth shares the header pill's full label.
  const rangeLabel =
    selectedPeriod && !isDay && !isHour ? formatMonthRangeShort(selectedPeriod) : formatHeaderRangeLabel(selectedPeriod, isDay, isHour);
  const points = chart ? toTrendPoints(chart, siteId) : [];
  return (
    <div style={{ ...card, marginBottom: "1.25rem" }}>
      {showPeriodNav && (
        <div style={{ marginBottom: "1.25rem" }}>
          <Breadcrumb siteId={siteId} selectedPeriod={selectedPeriod} isDay={isDay} isHour={isHour} />
        </div>
      )}

      <div style={{ paddingBottom: "1.25rem", borderBottom: `1px solid ${theme.color.border}`, marginBottom: "1.25rem" }}>
        <MetricRow
          pageviews={pageviews}
          uniques={uniques}
          pageviewsDelta={pageviewsDelta}
          uniquesDelta={uniquesDelta}
          previousPageviews={previousPageviews}
          sessionsSummary={sessionsSummary}
        />
      </div>

      <TrendAreaChart
        points={points}
        pageviewTotal={pageviews}
        uniquesTotal={uniques}
        metaRight={
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.6875rem", color: theme.color.textFaint }}>
            <span>Granularity: {granularity}</span>
            <span>•</span>
            <span style={{ color: theme.color.text, fontWeight: theme.font.weight.medium }}>{rangeLabel}</span>
          </div>
        }
      />
    </div>
  );
}

/** Maps each drill depth to labeled, linked trend points (ticks stay SSR-safe short strings). */
function toTrendPoints(chart: Exclude<Chart, null>, siteId: string): TrendPoint[] {
  const href = (period: string) => `/?siteId=${encodeURIComponent(siteId)}&month=${encodeURIComponent(period)}`;
  if (chart.kind === "monthly") {
    return chart.data.map((d) => {
      const [y, m] = d.month.split("-").map(Number);
      return {
        key: d.month,
        label: formatMonthLabel(d.month),
        tick: `${SHORT_MONTHS[m - 1]} ${y}`,
        pageviews: d.pageviews,
        uniques: d.uniques,
        href: href(d.month),
      };
    });
  }
  if (chart.kind === "daily") {
    return chart.data.map((d) => {
      const [, m, day] = d.day.split("-").map(Number);
      return {
        key: d.day,
        label: formatDayLabel(d.day),
        tick: `${SHORT_MONTHS[m - 1]} ${day}`,
        pageviews: d.pageviews,
        uniques: d.uniques,
        href: href(d.day),
      };
    });
  }
  return chart.data.map((d) => {
    // d.hour is a real ISO timestamp ("2026-08-08T11:00:00.000Z"); the UTC
    // fallback label/tick only shows until TrendAreaChart swaps in the
    // viewer's local rendering from tickIso after mount.
    const [day, time] = d.hour.split("T");
    const hourNum = time.slice(0, 2);
    return {
      key: d.hour,
      label: `${formatDayLabel(day)}, ${hourNum}:00 UTC`,
      tick: `${hourNum}:00`,
      tickIso: d.hour,
      pageviews: d.pageviews,
      uniques: d.uniques,
      href: href(d.hour.slice(0, 13)),
    };
  });
}
