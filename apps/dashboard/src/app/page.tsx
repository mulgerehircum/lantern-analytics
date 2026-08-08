import { aggregateEvents } from "@lantern/ingestion/aggregate";
import { getHourlyRollups, getLiveRawEvents, currentHourSK } from "@/lib/dynamodb";
import { summarizeRollups } from "@/lib/summarize";

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
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { siteId = "test-site" } = await searchParams;
  const [rollups, liveEvents] = await Promise.all([
    getHourlyRollups(siteId),
    getLiveRawEvents(siteId),
  ]);
  const liveRollup = { SK: currentHourSK(), ...aggregateEvents(liveEvents) };
  const summary = summarizeRollups([...rollups, liveRollup]);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
      <h1>Lantern Analytics — {siteId}</h1>
      {liveEvents.length > 0 && (
        <p style={{ color: "#4f46e5", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
          Includes {liveEvents.length} live event{liveEvents.length === 1 ? "" : "s"} from the current
          hour, not yet permanently rolled up.
        </p>
      )}

      <section style={{ display: "flex", gap: "2rem", margin: "1.5rem 0" }}>
        <Stat label="Pageviews" value={summary.totalPageviews} />
        <Stat label="Uniques (approx.)" value={summary.totalUniques} />
      </section>

      <TimeSeriesChart data={summary.timeSeries} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginTop: "2rem" }}>
        <Table title="Top pages" rows={summary.topPages.map((p) => [p.path, p.count] as const)} />
        <Table title="Referrers" rows={summary.referrers.map((r) => [r.referrer, r.count] as const)} />
        <Table title="Countries" rows={summary.countries.map((c) => [c.country, c.count] as const)} />
        <Table title="Devices" rows={summary.devices.map((d) => [d.device, d.count] as const)} />
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

function Table({ title, rows }: { title: string; rows: ReadonlyArray<readonly [string, number]> }) {
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
              <td style={{ padding: "4px 0" }}>{key || "(empty)"}</td>
              <td style={{ padding: "4px 0", textAlign: "right" }}>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
