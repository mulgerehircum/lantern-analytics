import { getSessionRecordings } from "@/lib/sessions";
import { DEFAULT_SITE_ID, getSite } from "@/lib/sites";
import { theme, card } from "@/lib/theme";
import { formatDuration } from "@/lib/format";
import { AppShell } from "@/components/AppShell";
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
    <AppShell
      siteId={siteId}
      siteUrl={site?.url}
      activeView="sessions"
      basePath="/sessions"
      title={
        <>
          {site ? site.name : siteId}
          {!site && <span style={{ fontSize: "0.85rem", fontWeight: 400, color: theme.color.amber }}> — not in site registry</span>}
        </>
      }
    >
      <div style={card}>
        <a
          href={`/sessions?siteId=${encodeURIComponent(siteId)}`}
          style={{ display: "inline-block", fontSize: "0.8rem", color: theme.color.brand, textDecoration: "none", fontWeight: theme.font.weight.semibold, marginBottom: "1.1rem" }}
        >
          ← Back to sessions
        </a>

        {session ? (
          <>
            <div style={{ display: "flex", gap: "1.6rem", marginBottom: "1.2rem", flexWrap: "wrap" }}>
              <MetaField label="Started" value={<LocalDateTime iso={session.startedAt} />} />
              <MetaField label="Duration" value={formatDuration(session.durationMs)} />
              <MetaField label="Pages" value={session.pageCount} />
              <MetaField label="Device" value={session.device ?? "—"} />
            </div>
            <div style={{ background: "oklch(0.22 0.02 110)", borderRadius: theme.radius.control, aspectRatio: "16/10", overflow: "hidden" }}>
              <ReplayPlayer siteId={siteId} sessionId={sessionId} />
            </div>
          </>
        ) : (
          <p style={{ color: theme.color.amber, marginTop: "1.5rem" }}>
            No recording found for this session (it may have expired, or the sessionId/siteId don&apos;t match).
          </p>
        )}
      </div>
    </AppShell>
  );
}

function MetaField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: "0.72rem", color: theme.color.textMuted }}>{label}</div>
      <div style={{ fontWeight: theme.font.weight.semibold, fontSize: "0.9rem" }}>{value}</div>
    </div>
  );
}
