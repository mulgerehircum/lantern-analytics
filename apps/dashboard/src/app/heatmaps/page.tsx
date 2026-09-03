import { notFound } from "next/navigation";
import { getAllRawEvents, getHourlyRollups, getLiveRawEvents, currentHourSK } from "@/lib/dynamodb";
import { aggregateEvents } from "@/lib/aggregate";
import { summarizeRollups } from "@/lib/summarize";
import { extractHeatmapClicks } from "@/lib/heatmap";
import { DEFAULT_SITE_ID, getSite } from "@/lib/sites";
import { HEATMAPS_ENABLED } from "@/lib/flags";
import { theme, card } from "@/lib/theme";
import { fieldStyle } from "@/components/ProjectSelector";
import { AppShell } from "@/components/AppShell";
import { HeatmapOverlay } from "@/components/HeatmapOverlay";

export default async function HeatmapsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!HEATMAPS_ENABLED) notFound();

  const params = await searchParams;
  const requestedSiteId = params.siteId?.trim() || DEFAULT_SITE_ID;
  const site = getSite(requestedSiteId);
  const siteId = site ? site.siteId : requestedSiteId;

  const [rawEvents, rollups, liveEvents] = await Promise.all([
    getAllRawEvents(siteId),
    getHourlyRollups(siteId),
    getLiveRawEvents(siteId),
  ]);
  const liveRollup = { SK: currentHourSK(), ...aggregateEvents(liveEvents) };
  const summary = summarizeRollups([...rollups, liveRollup]);

  // The selected path gets interpolated into an iframe src below - never
  // trust the raw query param for that. Validate against paths we actually
  // know about (from the site's own rollup data) before using it.
  const knownPaths = summary.topPages.map((p) => p.path);
  const requestedPath = params.path?.trim();
  const selectedPath = requestedPath && knownPaths.includes(requestedPath) ? requestedPath : (knownPaths[0] ?? "/");

  const points = extractHeatmapClicks(rawEvents, selectedPath);

  return (
    <AppShell
      siteId={siteId}
      siteUrl={site?.url}
      activeView="heatmaps"
      basePath="/heatmaps"
      title={
        <>
          {site ? site.name : siteId}
          {!site && <span style={{ fontSize: "0.85rem", fontWeight: 400, color: theme.color.amber }}> - not in site registry</span>}
        </>
      }
    >
      <p style={{ color: theme.color.textMuted, fontSize: "0.82rem", margin: "0 0 1.2rem" }}>
        Click density for one page, trailing ~30 days. Requires the tracked site&apos;s script tag to opt in via{" "}
        <code>data-heatmap</code>.
      </p>

      <form method="GET" style={{ ...card, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <input type="hidden" name="siteId" value={siteId} />
        <label style={{ fontSize: "0.78rem", color: theme.color.textMuted }}>
          Page
          <br />
          <select name="path" defaultValue={selectedPath} style={{ ...fieldStyle, width: 260 }}>
            {knownPaths.length === 0 && <option value="/">/</option>}
            {knownPaths.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          style={{ ...fieldStyle, cursor: "pointer", background: theme.color.brand, color: theme.color.onBrand, border: "none", alignSelf: "flex-end" }}
        >
          View
        </button>
      </form>

      {!site?.url ? (
        <p style={{ color: theme.color.textFaint, fontSize: "0.82rem" }}>No live site URL registered for this site - can&apos;t render a preview.</p>
      ) : points.length === 0 ? (
        <div style={card}>
          <p style={{ color: theme.color.textFaint, fontSize: "0.82rem", margin: 0 }}>
            No heatmap data yet for {selectedPath}. Enable click tracking by adding <code>data-heatmap</code> to this
            site&apos;s tracker <code>&lt;script&gt;</code> tag, then check back once visitors have clicked around.
          </p>
        </div>
      ) : (
        <HeatmapOverlay siteUrl={site.url} path={selectedPath} points={points} />
      )}
    </AppShell>
  );
}
