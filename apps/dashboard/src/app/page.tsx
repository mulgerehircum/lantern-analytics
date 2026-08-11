import { aggregateEvents } from "@/lib/aggregate";
import { getHourlyRollups, getLiveRawEvents, getAllRawEvents, currentHourSK } from "@/lib/dynamodb";
import { summarizeRollups } from "@/lib/summarize";
import type { DashboardSummary } from "@/lib/summarize";
import { buildFilteredRollups, hasActiveFilter, parseFilters } from "@/lib/filter";
import type { DashboardFilters } from "@/lib/filter";
import { DEFAULT_SITE_ID, getSite } from "@/lib/sites";
import { ProjectSelector, fieldStyle } from "@/components/ProjectSelector";

/**
 * Server Component — fetches DynamoDB directly, server-side. No client-side
 * fetch to a self-hosted API route: since this already runs on the server,
 * adding an HTTP round trip to our own API would be pure overhead. AWS
 * credentials never leave the server either way.
 *
 * Combines two sources into one summary: the permanent AGG# rollups (past
 * complete hours) plus a live-computed pseudo-rollup for the current,
 * still-incomplete hour (raw events, aggregated on the fly). See
 * docs/design.md and the "how does Simple Analytics show data instantly"
 * discussion this was built to answer — the live path exists specifically
 * to close that gap without giving up the free-tier-friendly rollup design
 * for historical data.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    siteId?: string;
    path?: string;
    referrer?: string;
    country?: string;
    device?: string;
    eventName?: string;
    eventKey?: string;
    eventValue?: string;
  }>;
}) {
  const params = await searchParams;
  // Registered sites are the normal case. An unregistered siteId still renders
  // (its data exists in DynamoDB) but is flagged below; the default is the
  // portfolio, the site with the most traffic.
  const requestedSiteId = params.siteId?.trim() || DEFAULT_SITE_ID;
  const site = getSite(requestedSiteId);
  const siteId = site ? site.siteId : requestedSiteId;
  const filters = parseFilters(params);

  // Rollups + live events are always fetched: the unfiltered summary is the
  // default view AND the source of the filter dropdown options.
  const [rollups, liveEvents] = await Promise.all([
    getHourlyRollups(siteId),
    getLiveRawEvents(siteId),
  ]);
  const liveRollup = { SK: currentHourSK(), ...aggregateEvents(liveEvents) };

  // When a dimension filter is active, the AGG# rollups can't answer it (they
  // store per-hour counts within each dimension, not cross-dimension slices) —
  // recompute from raw events instead. See lib/filter.ts for why this covers
  // only the trailing ~30 days.
  let summary: DashboardSummary;
  if (hasActiveFilter(filters)) {
    const rawEvents = await getAllRawEvents(siteId);
    summary = summarizeRollups(buildFilteredRollups(rawEvents, filters));
  } else {
    summary = summarizeRollups([...rollups, liveRollup]);
  }
  const filtered = hasActiveFilter(filters);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
      <ProjectSelector siteId={siteId} siteUrl={site?.url} />
      <h1 style={{ margin: "0.25rem 0 0" }}>
        Lantern Analytics — {site ? site.name : siteId}
        {site ? (
          <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "#666" }}>
            {" "}
            <a href={site.url} target="_blank" rel="noreferrer">
              (live)
            </a>
          </span>
        ) : (
          <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "#b45309" }}> — not in site registry</span>
        )}
        {" · "}
        <a href={`/sessions?siteId=${encodeURIComponent(siteId)}`} style={{ fontSize: "0.85rem", fontWeight: 400, color: "#4f46e5" }}>
          Sessions
        </a>
      </h1>
      {!filtered && liveEvents.length > 0 && (
        <p style={{ color: "#4f46e5", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
          Includes {liveEvents.length} live event{liveEvents.length === 1 ? "" : "s"} from the current
          hour, not yet permanently rolled up.
        </p>
      )}
      {filtered && (
        <p style={{ color: "#b45309", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
          Filtered view — recomputed from raw events, so it covers the trailing ~30 days (the
          raw-event TTL) rather than full history.
        </p>
      )}

      <FilterBar siteId={siteId} filters={filters} summary={summary} />

      <section style={{ display: "flex", gap: "2rem", margin: "1.5rem 0" }}>
        <Stat label="Pageviews" value={summary.totalPageviews} />
        <Stat label="Uniques (approx.)" value={summary.totalUniques} />
      </section>

      <TimeSeriesChart data={summary.timeSeries} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginTop: "2rem" }}>
        <Table title="Top pages" rows={summary.topPages.map((p) => [p.path, p.count] as const)} />
        <Table title="Referrers" rows={summary.referrers.map((r) => [r.referrer, r.count] as const)} />
        <Table
          title="Countries"
          rows={summary.countries.map((c) => [c.country, c.count] as const)}
          renderKey={(code) => <CountryLabel code={code} />}
        />
        <Table title="Devices" rows={summary.devices.map((d) => [d.device, d.count] as const)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginTop: "2rem" }}>
        <Table title="Custom events" rows={summary.customEvents.map((e) => [e.name, e.count] as const)} />
        <Table
          title="Custom event details"
          rows={summary.customEventBreakdown.map((b) => [`${b.name} · ${b.dimension}: ${b.value}`, b.count] as const)}
        />
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: "2rem", fontWeight: 700 }}>{value}</div>
      <div style={{ color: "#666" }}>{label}</div>
    </div>
  );
}

/**
 * Dimension filters. A plain GET form — no client JS, consistent with the
 * page's server-component design. Options are built from the unfiltered
 * summary so the dropdowns always show values that actually exist in the data.
 */
function FilterBar({
  siteId,
  filters,
  summary,
}: {
  siteId: string;
  filters: DashboardFilters;
  summary: DashboardSummary;
}) {
  return (
    <form
      method="GET"
      style={{
        display: "flex",
        gap: "0.5rem",
        alignItems: "flex-end",
        flexWrap: "wrap",
        margin: "1rem 0",
        padding: "0.75rem",
        border: "1px solid #ddd",
        borderRadius: 8,
      }}
    >
      <input type="hidden" name="siteId" value={siteId} />
      <label style={{ fontSize: "0.75rem", color: "#555" }}>
        Path
        <br />
        <input type="text" name="path" defaultValue={filters.path} placeholder="e.g. /proj" style={fieldStyle} />
      </label>
      <label style={{ fontSize: "0.75rem", color: "#555" }}>
        Referrer
        <br />
        <select name="referrer" defaultValue={filters.referrer ?? ""} style={fieldStyle}>
          <option value="">All</option>
          {summary.referrers.map((r) => (
            <option key={r.referrer} value={r.referrer}>
              {r.referrer}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: "0.75rem", color: "#555" }}>
        Country
        <br />
        <select name="country" defaultValue={filters.country ?? ""} style={fieldStyle}>
          <option value="">All</option>
          {summary.countries.map((c) => (
            <option key={c.country} value={c.country}>
              {c.country}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: "0.75rem", color: "#555" }}>
        Device
        <br />
        <select name="device" defaultValue={filters.device ?? ""} style={fieldStyle}>
          <option value="">All</option>
          {summary.devices.map((d) => (
            <option key={d.device} value={d.device}>
              {d.device}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: "0.75rem", color: "#555" }}>
        Event name
        <br />
        <select name="eventName" defaultValue={filters.eventName ?? ""} style={fieldStyle}>
          <option value="">All</option>
          {summary.customEvents.map((e) => (
            <option key={e.name} value={e.name}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: "0.75rem", color: "#555" }}>
        Event key
        <br />
        <select name="eventKey" defaultValue={filters.eventKey ?? ""} style={fieldStyle}>
          <option value="">Any</option>
          {[...new Set(summary.customEventBreakdown.map((b) => b.dimension))].map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: "0.75rem", color: "#555" }}>
        Event value
        <br />
        <select name="eventValue" defaultValue={filters.eventValue ?? ""} style={fieldStyle}>
          <option value="">Any</option>
          {[...new Set(summary.customEventBreakdown.map((b) => b.value))].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" style={{ ...fieldStyle, cursor: "pointer", background: "#4f46e5", color: "#fff", border: "none" }}>
        Filter
      </button>
      {hasActiveFilter(filters) && (
        <a href={`/?siteId=${encodeURIComponent(siteId)}`} style={{ fontSize: "0.85rem", color: "#4f46e5" }}>
          Clear
        </a>
      )}
    </form>
  );
}

function Table({
  title,
  rows,
  renderKey,
}: {
  title: string;
  rows: ReadonlyArray<readonly [string, number]>;
  renderKey?: (key: string) => React.ReactNode;
}) {
  return (
    <div>
      <h3>{title}</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td style={{ color: "#999" }}>No data yet</td>
            </tr>
          )}
          {rows.map(([key, count]) => (
            <tr key={key || "(empty)"}>
              <td style={{ padding: "4px 0" }}>{renderKey ? renderKey(key) : key || "(empty)"}</td>
              <td style={{ padding: "4px 0", textAlign: "right" }}>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Country flag from FlagCDN, keyed by ISO 3166-1 alpha-2 (lowercase). */
function CountryLabel({ code }: { code: string }) {
  if (!code || code.length !== 2) return <>{code || "(empty)"}</>;
  const flag = `https://flagcdn.com/w20/${code.toLowerCase()}.png`;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
      <img src={flag} alt={`${code} flag`} width={20} height={15} loading="lazy" style={{ borderRadius: 2 }} />
      {code}
    </span>
  );
}

/** Dependency-free bar chart — no charting library for something this simple. */
function TimeSeriesChart({ data }: { data: Array<{ hour: string; pageviews: number }> }) {
  if (data.length === 0) return <p style={{ color: "#999" }}>No data yet</p>;
  const max = Math.max(...data.map((d) => d.pageviews), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120, borderBottom: "1px solid #ddd" }}>
      {data.map((d) => (
        <div
          key={d.hour}
          title={`${d.hour}: ${d.pageviews}`}
          style={{
            width: 12,
            height: `${(d.pageviews / max) * 100}%`,
            background: "#4f46e5",
            borderRadius: "2px 2px 0 0",
          }}
        />
      ))}
    </div>
  );
}
