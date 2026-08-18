import { getAllRawEvents } from "@/lib/dynamodb";
import { getSessionRecordings } from "@/lib/sessions";
import { attachVariantToSessions } from "@/lib/experiment";
import { DEFAULT_SITE_ID, getSite } from "@/lib/sites";
import { ProjectSelector, fieldStyle } from "@/components/ProjectSelector";
import { LocalDateTime } from "@/components/LocalDateTime";

/**
 * Session list (Phase 2). Same conventions as the root dashboard page:
 * Server Component fetching DynamoDB directly, `?siteId=` query-param
 * routing (not `/[siteId]/...` — see repo decisions for why). The one bit of
 * client JS is <LocalDateTime> — timestamps need the viewer's own browser
 * timezone, which only the client knows.
 *
 * `variant` is attached per session (see lib/experiment.ts) by matching raw
 * card_variant_view events, not stored on the session item itself — so it's
 * only ever available for the trailing ~30 days the raw events survive.
 */
export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string; variant?: string }>;
}) {
  const params = await searchParams;
  const requestedSiteId = params.siteId?.trim() || DEFAULT_SITE_ID;
  const site = getSite(requestedSiteId);
  const siteId = site ? site.siteId : requestedSiteId;
  const variantFilter = params.variant?.trim() || undefined;

  const [sessions, events] = await Promise.all([getSessionRecordings(siteId), getAllRawEvents(siteId)]);
  const sessionsWithVariant = attachVariantToSessions(sessions, events);
  const availableVariants = [...new Set(sessionsWithVariant.map((s) => s.variant).filter((v): v is string => Boolean(v)))].sort();
  const filteredSessions = variantFilter
    ? sessionsWithVariant.filter((s) => s.variant === variantFilter)
    : sessionsWithVariant;

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
      <ProjectSelector siteId={siteId} siteUrl={site?.url} basePath="/sessions" />
      <h1 style={{ margin: "0.25rem 0 0" }}>
        Sessions — {site ? site.name : siteId}
        {" · "}
        <a href={`/?siteId=${encodeURIComponent(siteId)}`} style={{ fontSize: "0.85rem", fontWeight: 400, color: "#4f46e5" }}>
          Dashboard
        </a>
        {" · "}
        <a href={`/experiments?siteId=${encodeURIComponent(siteId)}`} style={{ fontSize: "0.85rem", fontWeight: 400, color: "#4f46e5" }}>
          Experiments
        </a>
      </h1>

      {availableVariants.length > 0 && (
        <VariantFilterForm siteId={siteId} variant={variantFilter} availableVariants={availableVariants} />
      )}

      <SessionsTable siteId={siteId} sessions={filteredSessions} />
    </main>
  );
}

function VariantFilterForm({
  siteId,
  variant,
  availableVariants,
}: {
  siteId: string;
  variant?: string;
  availableVariants: string[];
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
        Variant
        <br />
        <select name="variant" defaultValue={variant ?? ""} style={fieldStyle}>
          <option value="">All</option>
          {availableVariants.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" style={{ ...fieldStyle, cursor: "pointer", background: "#4f46e5", color: "#fff", border: "none" }}>
        Filter
      </button>
      {variant && (
        <a href={`/sessions?siteId=${encodeURIComponent(siteId)}`} style={{ fontSize: "0.85rem", color: "#4f46e5" }}>
          Clear
        </a>
      )}
    </form>
  );
}

function SessionsTable({
  siteId,
  sessions,
}: {
  siteId: string;
  sessions: Array<{
    sessionId: string;
    startedAt: string;
    durationMs: number;
    pageCount: number;
    path?: string;
    referrer?: string;
    country?: string;
    device?: string;
    variant?: string;
  }>;
}) {
  if (sessions.length === 0) {
    return <p style={{ color: "#999", marginTop: "1.5rem" }}>No recorded sessions yet.</p>;
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1.5rem" }}>
      <thead>
        <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
          <th style={{ padding: "6px 0" }}>Started</th>
          <th style={{ padding: "6px 0" }}>Duration</th>
          <th style={{ padding: "6px 0" }}>Pages</th>
          <th style={{ padding: "6px 0" }}>Landing page</th>
          <th style={{ padding: "6px 0" }}>Referrer</th>
          <th style={{ padding: "6px 0" }}>Country</th>
          <th style={{ padding: "6px 0" }}>Device</th>
          <th style={{ padding: "6px 0" }}>Variant</th>
        </tr>
      </thead>
      <tbody>
        {sessions.map((s) => (
          <tr key={s.sessionId} style={{ borderBottom: "1px solid #f0f0f0" }}>
            <td style={{ padding: "6px 0" }}>
              <a
                href={`/sessions/${encodeURIComponent(s.sessionId)}?siteId=${encodeURIComponent(siteId)}`}
                style={{ color: "#4f46e5" }}
              >
                <LocalDateTime iso={s.startedAt} />
              </a>
            </td>
            <td style={{ padding: "6px 0" }}>{formatDuration(s.durationMs)}</td>
            <td style={{ padding: "6px 0" }}>{s.pageCount}</td>
            <td style={{ padding: "6px 0" }}>{s.path || "—"}</td>
            <td style={{ padding: "6px 0" }}>{s.referrer || "direct"}</td>
            <td style={{ padding: "6px 0" }}>{s.country ?? "—"}</td>
            <td style={{ padding: "6px 0" }}>{s.device ?? "—"}</td>
            <td style={{ padding: "6px 0", textTransform: "capitalize" }}>{s.variant ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
