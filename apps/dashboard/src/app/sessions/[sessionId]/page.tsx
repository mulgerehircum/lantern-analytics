import Link from "next/link";
import { getSessionRecordings } from "@/lib/sessions";
import { getAllRawEvents } from "@/lib/dynamodb";
import { findCustomEventsForSession } from "@/lib/session-correlation";
import { DEFAULT_SITE_ID, getSite } from "@/lib/sites";
import { theme, card } from "@/lib/theme";
import { formatDuration } from "@/lib/format";
import { AppShell } from "@/components/AppShell";
import { SessionReplay } from "@/components/SessionReplay";
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
  searchParams: Promise<{ siteId?: string; t?: string }>;
}) {
  const { sessionId } = await params;
  const query = await searchParams;
  const requestedSiteId = query.siteId?.trim() || DEFAULT_SITE_ID;
  const site = getSite(requestedSiteId);
  const siteId = site ? site.siteId : requestedSiteId;

  const [sessions, rawEvents] = await Promise.all([getSessionRecordings(siteId), getAllRawEvents(siteId)]);
  const session = sessions.find((s) => s.sessionId === sessionId);
  const customEvents = session
    ? findCustomEventsForSession(session, rawEvents).map((e) => ({ offsetMs: e.offsetMs, name: e.name!, metadata: e.metadata }))
    : [];
  const rawOffset = query.t ? Number(query.t) : undefined;
  const initialOffsetMs = rawOffset !== undefined && Number.isFinite(rawOffset) ? rawOffset : undefined;

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
        <Link
          href={`/sessions?siteId=${encodeURIComponent(siteId)}`}
          style={{ display: "inline-block", fontSize: "0.8rem", color: theme.color.brand, textDecoration: "none", fontWeight: theme.font.weight.semibold, marginBottom: "1.1rem" }}
        >
          ← Back to sessions
        </Link>

        {session ? (
          <>
            <div style={{ display: "flex", gap: "1.6rem", marginBottom: "1.2rem", flexWrap: "wrap" }}>
              <MetaField label="Started" value={<LocalDateTime iso={session.startedAt} />} />
              <MetaField label="Duration" value={formatDuration(session.durationMs)} />
              <MetaField label="Pages" value={session.pageCount} />
              <MetaField label="Device" value={session.device ?? "—"} />
            </div>
            {/* No fixed aspect-ratio here — ReplayPlayer measures this
                container's actual width and constructs the (fixed-size,
                non-resizing) rrweb player to match it, so forcing a
                separate ratio on the container would just reintroduce the
                mismatch/clipping bug this replaced. Plain block layout, not
                flex — a flex item's "auto" width shrinks to content instead
                of filling the container, which would make ReplayPlayer's
                width measurement (taken before the player has any content)
                read as ~0. */}
            <div style={{ background: "oklch(0.22 0.02 110)", borderRadius: theme.radius.control, padding: "1rem", boxSizing: "border-box" }}>
              <SessionReplay
                siteId={siteId}
                sessionId={sessionId}
                sessionStartedAt={session.startedAt}
                customEvents={customEvents}
                initialOffsetMs={initialOffsetMs}
              />
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
