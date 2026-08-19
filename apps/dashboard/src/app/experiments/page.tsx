import { getAllRawEvents } from "@/lib/dynamodb";
import { summarizeExperiment } from "@/lib/experiment";
import type { ExperimentVariantStats } from "@/lib/experiment";
import { DEFAULT_SITE_ID, getSite } from "@/lib/sites";
import { ProjectSelector } from "@/components/ProjectSelector";

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
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
      <ProjectSelector siteId={siteId} siteUrl={site?.url} basePath="/experiments" />
      <h1 style={{ margin: "0.25rem 0 0" }}>
        Experiments — {site ? site.name : siteId}
        {" · "}
        <a href={`/?siteId=${encodeURIComponent(siteId)}`} style={{ fontSize: "0.85rem", fontWeight: 400, color: "#4f46e5" }}>
          Dashboard
        </a>
        {" · "}
        <a href={`/sessions?siteId=${encodeURIComponent(siteId)}`} style={{ fontSize: "0.85rem", fontWeight: 400, color: "#4f46e5" }}>
          Sessions
        </a>
      </h1>
      <p style={{ color: "#b45309", fontSize: "0.85rem", margin: "0.25rem 0 1rem" }}>
        Built from raw events, which live for ~30 days — this covers the trailing 30 days, not full history.
      </p>

      <h2 style={{ fontSize: "1rem", margin: "1.5rem 0 0.5rem" }}>Live iframe vs. video card</h2>
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
    </main>
  );
}

function VariantTable({ title, stats }: { title: string; stats: ExperimentVariantStats[] }) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <h3 style={{ fontSize: "0.85rem", color: "#555", margin: "0 0 0.4rem" }}>{title}</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th style={{ padding: "6px 0" }}>Variant</th>
            <th style={{ padding: "6px 0", textAlign: "right" }}>Impressions</th>
            <th style={{ padding: "6px 0", textAlign: "right" }}>Live clicks</th>
            <th style={{ padding: "6px 0", textAlign: "right" }}>Expand clicks</th>
            <th style={{ padding: "6px 0", textAlign: "right" }}>GitHub clicks</th>
            <th style={{ padding: "6px 0", textAlign: "right" }}>CTR (live)</th>
            <th style={{ padding: "6px 0", textAlign: "right" }}>Engagement</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.variant} style={{ borderBottom: "1px solid #f0f0f0" }}>
              <td style={{ padding: "6px 0", textTransform: "capitalize" }}>{s.variant}</td>
              <td style={{ padding: "6px 0", textAlign: "right" }}>{s.impressions}</td>
              <td style={{ padding: "6px 0", textAlign: "right" }}>{s.liveClicks}</td>
              <td style={{ padding: "6px 0", textAlign: "right" }}>{s.expandClicks}</td>
              <td style={{ padding: "6px 0", textAlign: "right" }}>{s.githubClicks}</td>
              <td style={{ padding: "6px 0", textAlign: "right" }}>{s.ctrPercent}%</td>
              <td style={{ padding: "6px 0", textAlign: "right" }}>{s.engagementPercent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
