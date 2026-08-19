import Link from "next/link";
import { theme } from "@/lib/theme";
import { formatDayLabel, formatMonthLabel } from "@/lib/months";
import type { DailyTrendPoint, MonthlyTrendPoint } from "@/lib/summarize";
import { HourBar } from "./HourBar";

/**
 * The three bar-chart renderers for the Overview chart card — one per drill
 * depth (root/month/day), rendered by ChartCard, never more than one at a
 * time. Dependency-free — no charting library — every bar is a Link that
 * drills one level deeper and gets prefetched on hover/viewport-entry.
 *
 * Pixel heights, not CSS percentages: each bar's parent is the Link wrapping
 * it, which has no explicit height of its own — a `%` height resolves
 * against that undefined height and collapses to ~0.
 */
const BAR_AREA_PX = 80;

export function MonthlyTrendChart({ siteId, data }: { siteId: string; data: MonthlyTrendPoint[] }) {
  if (data.length === 0) return <p style={{ color: theme.color.textFaint, fontSize: "0.82rem" }}>No data yet</p>;
  const max = Math.max(...data.map((d) => d.pageviews), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: BAR_AREA_PX }}>
      {data.map((d) => (
        <Link
          key={d.month}
          href={`/?siteId=${encodeURIComponent(siteId)}&month=${encodeURIComponent(d.month)}`}
          title={`${formatMonthLabel(d.month)}: ${d.pageviews} pageviews`}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 24, textDecoration: "none" }}
        >
          <div
            style={{
              width: 16,
              height: Math.max(Math.round((d.pageviews / max) * BAR_AREA_PX), d.pageviews > 0 ? 2 : 0),
              background: theme.color.brand,
              borderRadius: "4px 4px 0 0",
            }}
          />
        </Link>
      ))}
    </div>
  );
}

export function DailyTrendChart({ siteId, data }: { siteId: string; data: DailyTrendPoint[] }) {
  if (data.length === 0) return <p style={{ color: theme.color.textFaint, fontSize: "0.82rem" }}>No data yet</p>;
  const max = Math.max(...data.map((d) => d.pageviews), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: BAR_AREA_PX }}>
      {data.map((d) => (
        <Link
          key={d.day}
          href={`/?siteId=${encodeURIComponent(siteId)}&month=${encodeURIComponent(d.day)}`}
          title={`${formatDayLabel(d.day)}: ${d.pageviews} pageviews`}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 12, textDecoration: "none" }}
        >
          <div
            style={{
              width: 10,
              height: Math.max(Math.round((d.pageviews / max) * BAR_AREA_PX), d.pageviews > 0 ? 2 : 0),
              background: theme.color.brand,
              borderRadius: "4px 4px 0 0",
            }}
          />
        </Link>
      ))}
    </div>
  );
}

export function TimeSeriesChart({ siteId, data }: { siteId: string; data: Array<{ hour: string; pageviews: number }> }) {
  if (data.length === 0) return <p style={{ color: theme.color.textFaint, fontSize: "0.82rem" }}>No data yet</p>;
  const max = Math.max(...data.map((d) => d.pageviews), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: BAR_AREA_PX }}>
      {data.map((d) => (
        <HourBar
          key={d.hour}
          hour={d.hour}
          pageviews={d.pageviews}
          heightPx={Math.round((d.pageviews / max) * BAR_AREA_PX)}
          href={`/?siteId=${encodeURIComponent(siteId)}&month=${d.hour.slice(0, 13)}`}
        />
      ))}
    </div>
  );
}
