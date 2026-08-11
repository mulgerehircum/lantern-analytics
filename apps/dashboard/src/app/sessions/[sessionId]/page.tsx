import { getSessionRecordings } from "@/lib/sessions";
import { DEFAULT_SITE_ID, getSite } from "@/lib/sites";
import { ProjectSelector } from "@/components/ProjectSelector";
import { ReplayPlayer } from "@/components/ReplayPlayer";
import { LocalDateTime } from "@/components/LocalDateTime";

/**
 * Session replay detail page. Looks the session up via the same
 * `getSessionRecordings` call the list page uses rather than adding a second
 * DynamoDB access pattern — cheap at this project's traffic scale, same
 * reasoning `getAllRawEvents` already relies on in lib/dynamodb.ts.
 */
export default async function SessionReplayPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { sessionId } = await params;
  const query = await searchParams;
  const requestedSiteId = query.siteId?.trim() || DEFAULT_SITE_ID;
  const site = getSite(requestedSiteId);
  const siteId = site ? site.siteId : requestedSiteId;

  const sessions = await getSessionRecordings(siteId);
  const session = sessions.find((s) => s.sessionId === sessionId);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      <ProjectSelector siteId={siteId} siteUrl={site?.url} basePath="/sessions" />
      <h1 style={{ margin: "0.25rem 0 0" }}>
        Session replay
        {" · "}
        <a href={`/sessions?siteId=${encodeURIComponent(siteId)}`} style={{ fontSize: "0.85rem", fontWeight: 400, color: "#4f46e5" }}>
          Back to sessions
        </a>
      </h1>

      {session ? (
        <>
          <p style={{ color: "#666", fontSize: "0.85rem" }}>
            Started <LocalDateTime iso={session.startedAt} /> · {session.pageCount} page
            {session.pageCount === 1 ? "" : "s"}
            {session.path ? <> · landed on {session.path}</> : null}
            {session.referrer ? <> · via {session.referrer}</> : null}
            {session.country ? <> · {session.country}</> : null}
            {session.device ? <> · {session.device}</> : null}
          </p>
          <ReplayPlayer siteId={siteId} sessionId={sessionId} />
        </>
      ) : (
        <p style={{ color: "#b45309", marginTop: "1.5rem" }}>
          No recording found for this session (it may have expired, or the sessionId/siteId don't match).
        </p>
      )}
    </main>
  );
}
