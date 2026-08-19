import { getAllRawEvents } from "@/lib/dynamodb";
import { summarizeExperiment } from "@/lib/experiment";
import type { ExperimentVariantStats } from "@/lib/experiment";
import { DEFAULT_SITE_ID, getSite } from "@/lib/sites";
import { theme, card } from "@/lib/theme";
import { AppShell } from "@/components/AppShell";

/**
 * Dedicated view for the portfolio's live-iframe-vs-video card experiment
 * (see my-portfolio's utils/experiment.ts) — impressions, clicks, and CTR per
 * variant, overall and broken down per project. Built from raw events (see
 * lib/experiment.ts), so coverage is the trailing ~30 days, same as the
 * dashboard's dimension filters.
 */
export default async function ExperimentsPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const params = await searchParams;
  const requestedSiteId = params.siteId?.trim() || DEFAULT_SITE_ID;
  const site = getSite(requestedSiteId);
  const siteId = site ? site.siteId : requestedSiteId;

  const events = await getAllRawEvents(siteId);
  const experiment = summarizeExperiment(events);

  return (
    <AppShell
      siteId={siteId}
      siteUrl={site?.url}
      activeView="experiments"
      basePath="/experiments"
      title={
        <>
          {site ? site.name : siteId}
          {!site && <span style={{ fontSize: "0.85rem", fontWeight: 400, color: theme.color.amber }}> — not in site registry</span>}
        </>
      }
    >
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.2rem", flexWrap: "wrap", gap: "0.4rem" }}>
          <div style={{ fontWeight: theme.font.weight.semibold, fontSize: "0.85rem" }}>Experiments</div>
          <div style={{ fontSize: "0.72rem", color: theme.color.amber }}>Live iframe vs. video card · trailing 30 days</div>
        </div>

        {experiment.overall.length === 0 ? (
          <p style={{ color: "#999" }}>No experiment data in the last ~30 days.</p>
        ) : (
          <>
            <VariantTable title="Overall" stats={experiment.overall} />
            {experiment.byProject.map((p) => (
              <VariantTable key={p.project} title={p.project} stats={p.variants} />
            ))}
          </>
        )}
      </div>
    </AppShell>
  );
}

function VariantTable({ title, stats }: { title: string; stats: ExperimentVariantStats[] }) {
  return (
    <div style={{ marginTop: "1.1rem" }}>
      <div style={{ fontSize: "0.78rem", fontWeight: theme.font.weight.semibold, color: theme.color.textMuted, marginBottom: "0.4rem" }}>{title}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
        <thead>
          <tr style={{ textAlign: "left", color: theme.color.textMuted, fontWeight: theme.font.weight.medium }}>
            <th style={{ padding: "0.4rem 0.6rem 0.4rem 0", borderBottom: `1px solid ${theme.color.cardBorder}` }}>Variant</th>
            <th style={{ padding: "0.4rem 0.6rem", textAlign: "right", borderBottom: `1px solid ${theme.color.cardBorder}` }}>Impressions</th>
            <th style={{ padding: "0.4rem 0.6rem", textAlign: "right", borderBottom: `1px solid ${theme.color.cardBorder}` }}>Live clicks</th>
            <th style={{ padding: "0.4rem 0.6rem", textAlign: "right", borderBottom: `1px solid ${theme.color.cardBorder}` }}>Expand clicks</th>
            <th style={{ padding: "0.4rem 0.6rem", textAlign: "right", borderBottom: `1px solid ${theme.color.cardBorder}` }}>GitHub clicks</th>
            <th style={{ padding: "0.4rem 0.6rem", textAlign: "right", borderBottom: `1px solid ${theme.color.cardBorder}` }}>CTR</th>
            <th style={{ padding: "0.4rem 0 0.4rem 0.6rem", textAlign: "right", borderBottom: `1px solid ${theme.color.cardBorder}` }}>Engagement</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.variant} style={{ borderTop: `1px solid ${theme.color.cardBorder}` }}>
              <td style={{ padding: "0.5rem 0.6rem 0.5rem 0", fontWeight: theme.font.weight.semibold, textTransform: "capitalize" }}>{s.variant}</td>
              <td style={{ padding: "0.5rem 0.6rem", textAlign: "right" }}>{s.impressions}</td>
              <td style={{ padding: "0.5rem 0.6rem", textAlign: "right" }}>{s.liveClicks}</td>
              <td style={{ padding: "0.5rem 0.6rem", textAlign: "right" }}>{s.expandClicks}</td>
              <td style={{ padding: "0.5rem 0.6rem", textAlign: "right" }}>{s.githubClicks}</td>
              <td style={{ padding: "0.5rem 0.6rem", textAlign: "right", fontWeight: theme.font.weight.semibold, color: theme.color.brandTintTextStrong }}>{s.ctrPercent}%</td>
              <td style={{ padding: "0.5rem 0 0.5rem 0.6rem", textAlign: "right", fontWeight: theme.font.weight.semibold, color: theme.color.brandTintTextStrong }}>{s.engagementPercent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
