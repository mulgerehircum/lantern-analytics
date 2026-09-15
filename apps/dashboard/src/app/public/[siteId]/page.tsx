import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { aggregateEvents } from "@/lib/aggregate";
import { getHourlyRollups, getLiveRawEvents, currentHourSK } from "@/lib/dynamodb";
import { summarizeRollups } from "@/lib/summarize";
import { getPublicSite } from "@/lib/sites";
import type { SiteInfo } from "@/lib/sites";
import { theme, card } from "@/lib/theme";
import { DataTableCard } from "@/components/DataTableCard";
import type { DataTableRow } from "@/components/DataTableCard";

/**
 * Public stats page (Simple Analytics-style shareable URL): all-time
 * referrers + pageview/unique totals for one opt-in site. The site's owner
 * shares this link; anyone with it sees aggregate numbers.
 *
 * Deliberate constraints:
 * - Opt-in gate via getPublicSite (publicStats flag) - registered but
 *   non-opted sites and unknown ids alike get notFound(), so the page never
 *   leaks which sites exist.
 * - Aggregate-only: hostname counts and two totals. Never paths, countries,
 *   devices, or session data - the privacy-first pitch has to hold on a
 *   public artifact, same reasoning as the widget endpoint's minimal shape.
 * - No AppShell: no site switcher, no nav into the private views, no AI
 *   affordances - just a header, two totals, and the referrer table. Theme
 *   tokens come from the root layout, so light/dark works unchanged.
 * - Same read model as the Sources page (rollups + live-hour pseudo-rollup);
 *   getHourlyRollups/getLiveRawEvents are already 60s-cached in the data
 *   layer, and revalidate=60 below adds page-level ISR on top for cheap
 *   CDN serving of a public URL.
 */
export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ siteId: string }> }): Promise<Metadata> {
  const { siteId } = await params;
  const site = getPublicSite(siteId);
  return {
    title: site ? `${site.name} — public traffic stats` : "Public traffic stats",
    description: site
      ? `All-time pageviews, unique visitors, and where its traffic comes from — counted by Lantern, a privacy-first analytics project.`
      : "Public traffic statistics, counted by Lantern.",
  };
}

/** Plain two-stat card row - no DeltaBadge/comparison chrome (there's no private "previous period" to compare against for an anonymous visitor). */
function PublicStatCard({ label, value, tooltip }: { label: string; value: string; tooltip: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: "0.75rem", fontWeight: theme.font.weight.medium, color: theme.color.textMuted, display: "flex", alignItems: "center", gap: "0.375rem" }}>
        {label}
        <i className="fa-regular fa-circle-question" title={tooltip} style={{ fontSize: "0.625rem", color: theme.color.textFaint, cursor: "help" }} />
      </span>
      <span style={{ fontSize: "1.875rem", fontWeight: theme.font.weight.extrabold, letterSpacing: "-0.02em", lineHeight: 1.2, marginTop: "0.25rem", color: theme.color.text, fontFamily: theme.font.mono }}>
        {value}
      </span>
    </div>
  );
}

function PublicStatsHeader({ site }: { site: SiteInfo }) {
  return (
    <header style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.4rem" }}>
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "2.1rem",
          height: "2.1rem",
          borderRadius: theme.radius.control,
          background: theme.color.brand,
          color: theme.color.onBrand,
          fontSize: "1rem",
          flexShrink: 0,
        }}
      >
        <i className="fa-solid fa-chart-simple" />
      </span>
      <div>
        <h1 style={{ margin: 0, fontSize: "1.15rem", fontWeight: theme.font.weight.bold, color: theme.color.text }}>
          {site.name}
          {site.url && (
            <a
              href={site.url}
              target="_blank"
              rel="noopener"
              style={{ fontSize: "0.8rem", fontWeight: theme.font.weight.regular, color: theme.color.textMuted, textDecoration: "none", marginLeft: "0.5rem" }}
            >
              {new URL(site.url).hostname} <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: "0.6rem" }} aria-hidden />
            </a>
          )}
        </h1>
        <p style={{ margin: 0, fontSize: "0.8rem", color: theme.color.textMuted }}>
          Public traffic statistics — all time
        </p>
      </div>
    </header>
  );
}

export default async function PublicStatsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = getPublicSite(siteId);
  if (!site) notFound();

  // Identical to the Sources page's merge: permanent AGG# rollups plus a
  // live-computed pseudo-rollup for the current incomplete hour.
  const [rollups, liveEvents] = await Promise.all([getHourlyRollups(siteId), getLiveRawEvents(siteId)]);
  const liveRollup = { SK: currentHourSK(), ...aggregateEvents(liveEvents) };
  const summary = summarizeRollups([...rollups, liveRollup]);

  const rows: DataTableRow[] = summary.referrers.map((r) => ({
    key: r.referrer || "(empty)",
    count: r.count,
    // No href: public rows are plain text, never links into the private
    // dashboard's filter views.
  }));

  return (
    <div style={{ maxWidth: "52rem", margin: "0 auto", padding: "2rem 1.2rem 3rem" }}>
      <PublicStatsHeader site={site} />

      <div style={{ ...card, display: "flex", gap: "2.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <PublicStatCard
          label="Pageviews"
          value={String(summary.totalPageviews)}
          tooltip="Total page requests, all time"
        />
        <PublicStatCard
          label="Unique Visitors"
          value={String(summary.totalUniques)}
          tooltip="Pageviews flagged as new visits, summed across the view"
        />
      </div>

      <DataTableCard
        title="Where traffic comes from"
        subtitle="All-time pageviews per referrer"
        icon="fa-solid fa-arrow-turn-down-left"
        rows={rows}
        initialVisibleCount={10}
        exportFilename={`${siteId}-sources.csv`}
        footnote="Hostname only, never the full referring URL — no query-string PII ever leaves the tracked site."
      />

      <p style={{ marginTop: "1.4rem", fontSize: "0.8rem", color: theme.color.textMuted, textAlign: "center" }}>
        Counted by{" "}
        <a
          href="/"
          style={{ color: theme.color.brandTintTextStrong, textDecoration: "underline", textUnderlineOffset: 2 }}
        >
          Lantern
        </a>
        , a cookieless, privacy-first analytics project. No cookies, no consent banner, hashed IPs, DNT-respected.
      </p>
    </div>
  );
}
