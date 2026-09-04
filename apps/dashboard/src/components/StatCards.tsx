import { theme, card } from "@/lib/theme";
import { formatDuration } from "@/lib/format";
import type { SessionsSummary } from "@/lib/summarize";

function DeltaBadge({ delta, invert }: { delta: number | null | undefined; invert?: boolean }) {
  if (delta === undefined) return null;
  if (delta === null) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          fontSize: "0.6875rem",
          fontWeight: theme.font.weight.semibold,
          color: theme.color.textMuted,
          background: theme.color.brandTintBg,
          padding: "2px 6px",
          borderRadius: theme.radius.small,
          border: `1px solid ${theme.color.border}`,
        }}
      >
        new
      </span>
    );
  }
  // Bounce is inverted: a falling bounce rate is good news.
  const up = invert ? delta <= 0 : delta >= 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        fontSize: "0.6875rem",
        fontWeight: theme.font.weight.semibold,
        color: up ? theme.color.brandTintTextStrong : theme.color.danger,
        background: up ? theme.color.brandTintBg : theme.color.bg,
        padding: "2px 6px",
        borderRadius: theme.radius.small,
        border: `1px solid ${theme.color.border}`,
      }}
    >
      <i className={delta >= 0 ? "fa-solid fa-arrow-trend-up" : "fa-solid fa-arrow-trend-down"} style={{ fontSize: "0.5625rem" }} />
      {delta >= 0 ? "+" : ""}
      {delta}%
    </span>
  );
}

function StatCard({
  label,
  value,
  delta,
  invertTrend,
  context,
  tooltip,
  divided,
}: {
  label: string;
  value: string;
  delta?: number | null;
  invertTrend?: boolean;
  context?: string;
  tooltip: string;
  /** Stats after the first get a left divider. */
  divided?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        ...(divided ? { borderLeft: `1px solid ${theme.color.border}`, paddingLeft: "1rem" } : undefined),
      }}
    >
      <span style={{ fontSize: "0.75rem", fontWeight: theme.font.weight.medium, color: theme.color.textMuted, display: "flex", alignItems: "center", gap: "0.375rem" }}>
        {label}
        <i className="fa-regular fa-circle-question" title={tooltip} style={{ fontSize: "0.625rem", color: theme.color.textFaint, cursor: "help" }} />
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.625rem", marginTop: "0.25rem" }}>
        <span style={{ fontSize: "1.875rem", fontWeight: theme.font.weight.extrabold, letterSpacing: "-0.02em", lineHeight: 1.2, color: theme.color.text, fontFamily: theme.font.mono }}>
          {value}
        </span>
        <DeltaBadge delta={delta} invert={invertTrend} />
      </div>
      {context && <span style={{ fontSize: "0.6875rem", color: theme.color.textFaint, marginTop: "0.125rem" }}>{context}</span>}
    </div>
  );
}

export function MetricRow({
  pageviews,
  uniques,
  pageviewsDelta,
  uniquesDelta,
  previousPageviews,
  sessionsSummary,
}: {
  pageviews: number;
  uniques: number;
  pageviewsDelta?: number | null;
  uniquesDelta?: number | null;
  previousPageviews?: number;
  sessionsSummary: SessionsSummary;
}) {
  const conversionRate = pageviews > 0 ? ((uniques / pageviews) * 100).toFixed(1) : "0.0";
  const avgSessionLabel = formatDuration(sessionsSummary.avgDurationSeconds * 1000);
  const bounceLabel = `${sessionsSummary.bounceRatePercent.toFixed(1)}%`;

  return (
    <div className="lantern-grid-4">
      <StatCard
        label="Pageviews"
        value={String(pageviews)}
        delta={pageviewsDelta}
        context={previousPageviews !== undefined ? `vs ${previousPageviews} previous period` : undefined}
        tooltip="Total page requests"
      />
      <StatCard
        label="Unique Visitors"
        value={String(uniques)}
        delta={uniquesDelta}
        context={`${conversionRate}% conversion rate`}
        tooltip="Pageviews flagged as new visits, summed across the view"
        divided
      />
      <StatCard
        label="Avg. Session Time"
        value={avgSessionLabel}
        context="High content engagement"
        tooltip="Mean recorded session duration (all-time sessions)"
        divided
      />
      <StatCard
        label="Bounce Rate"
        value={bounceLabel}
        invertTrend
        context="Optimal for 1-page portfolios"
        tooltip="Share of recorded sessions that viewed a single page"
        divided
      />
    </div>
  );
}
