import { theme, card } from "@/lib/theme";
import { formatDuration } from "@/lib/format";
import type { SessionsSummary } from "@/lib/summarize";

function DeltaBadge({ delta }: { delta: number | null | undefined }) {
  if (delta === undefined || delta === null) {
    // Spec shows "new" when previous is 0, but for session metrics without previous data we show no badge
    if (delta === null) {
      return <span style={{ fontSize: "0.72rem", color: theme.color.textMuted }}>new</span>;
    }
    return null;
  }
  const up = delta >= 0;
  // Spec: negative deltas use danger, positive use brand
  return (
    <span
      style={{
        fontSize: "0.72rem",
        fontWeight: theme.font.weight.semibold,
        color: up ? theme.color.brand : theme.color.danger,
      }}
    >
      {up ? "+" : ""}
      {delta}%
    </span>
  );
}

function StatCard({
  label,
  value,
  delta,
  context,
}: {
  label: string;
  value: string;
  delta?: number | null;
  context?: string;
}) {
  return (
    <div style={{ ...card, padding: "1rem 1.2rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <div style={{ fontSize: "0.72rem", color: theme.color.textMuted, fontWeight: theme.font.weight.medium, letterSpacing: "0.02em" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
        <div style={{ fontSize: "1.6rem", fontWeight: theme.font.weight.bold, lineHeight: 1 }}>{value}</div>
        <DeltaBadge delta={delta} />
      </div>
      {context && <div style={{ fontSize: "0.72rem", color: theme.color.textMutedLight }}>{context}</div>}
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
    <div className="lantern-grid-4" style={{ marginBottom: "1rem" }}>
      <StatCard
        label="Pageviews"
        value={String(pageviews)}
        delta={pageviewsDelta}
        context={previousPageviews !== undefined ? `vs ${previousPageviews} previous period` : undefined}
      />
      <StatCard
        label="Unique Visitors"
        value={String(uniques)}
        delta={uniquesDelta}
        context={`${conversionRate}% conversion rate`}
      />
      <StatCard label="Avg. Session Time" value={avgSessionLabel} context="High content engagement" />
      <StatCard label="Bounce Rate" value={bounceLabel} context="Optimal for 1-page portfolios" />
    </div>
  );
}
