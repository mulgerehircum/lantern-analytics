import { getSessionRecordings } from "@/lib/sessions";
import { DEFAULT_SITE_ID, getSite } from "@/lib/sites";
import { ProjectSelector } from "@/components/ProjectSelector";

/**
 * Session list (Phase 2). Same conventions as the root dashboard page:
 * Server Component fetching DynamoDB directly, `?siteId=` query-param
 * routing (not `/[siteId]/...` — see repo decisions for why), no client JS.
 */
export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const params = await searchParams;
  const requestedSiteId = params.siteId?.trim() || DEFAULT_SITE_ID;
  const site = getSite(requestedSiteId);
  const siteId = site ? site.siteId : requestedSiteId;

  const sessions = await getSessionRecordings(siteId);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
      <ProjectSelector siteId={siteId} siteUrl={site?.url} basePath="/sessions" />
      <h1 style={{ margin: "0.25rem 0 0" }}>
        Sessions — {site ? site.name : siteId}
        {" · "}
        <a href={`/?siteId=${encodeURIComponent(siteId)}`} style={{ fontSize: "0.85rem", fontWeight: 400, color: "#4f46e5" }}>
          Back to dashboard
        </a>
      </h1>

      <SessionsTable siteId={siteId} sessions={sessions} />
    </main>
  );
}

function SessionsTable({
  siteId,
  sessions,
}: {
  siteId: string;
  sessions: Array<{ sessionId: string; startedAt: string; durationMs: number; pageCount: number }>;
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
                {new Date(s.startedAt).toLocaleString()}
              </a>
            </td>
            <td style={{ padding: "6px 0" }}>{formatDuration(s.durationMs)}</td>
            <td style={{ padding: "6px 0" }}>{s.pageCount}</td>
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
