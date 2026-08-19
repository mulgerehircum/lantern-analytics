"use client";

import { useEffect, useRef, useState } from "react";
import type RrwebPlayer from "rrweb-player";
import type { eventWithTime } from "@rrweb/types";
import { theme } from "@/lib/theme";
import { ReplayPlayer } from "./ReplayPlayer";
import { InteractionTimeline } from "./InteractionTimeline";
import type { CustomEventTimelineInput } from "@/lib/interaction-timeline";

/**
 * Owns the one fetch of the recording, the loading/empty/error/loaded
 * status UI (moved here from ReplayPlayer.tsx, verbatim), the constructed
 * player instance (so it and InteractionTimeline can both act on it), and
 * seeking to a deep-linked timestamp on first load. Fetches from the
 * dashboard's own /api/recordings route (never the Mac-mini receiver
 * directly — see that route's doc comment).
 */
export function SessionReplay({
  siteId,
  sessionId,
  sessionStartedAt,
  customEvents,
  initialOffsetMs,
}: {
  siteId: string;
  sessionId: string;
  sessionStartedAt: string;
  customEvents: CustomEventTimelineInput[];
  initialOffsetMs?: number;
}) {
  const [status, setStatus] = useState<"loading" | "empty" | "error" | "loaded">("loading");
  const [events, setEvents] = useState<eventWithTime[] | null>(null);
  const [player, setPlayer] = useState<RrwebPlayer | null>(null);
  const seekedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/recordings?siteId=${encodeURIComponent(siteId)}&sessionId=${encodeURIComponent(sessionId)}`);
        if (!res.ok) {
          if (!cancelled) setStatus("error");
          return;
        }
        const data: { events?: eventWithTime[] } = await res.json();
        if (cancelled) return;

        if (!data.events || data.events.length === 0) {
          setStatus("empty");
          return;
        }

        setEvents(data.events);
        setStatus("loaded");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [siteId, sessionId]);

  // Seeks once, the first time the player becomes ready — guarded so it
  // never re-fires on an unrelated re-render after the initial jump.
  useEffect(() => {
    if (!player || seekedRef.current || initialOffsetMs === undefined) return;
    seekedRef.current = true;
    player.goto(initialOffsetMs, true);
  }, [player, initialOffsetMs]);

  return (
    <div>
      {status === "loading" && <p style={{ color: theme.color.textFaint, marginTop: "1rem" }}>Loading recording…</p>}
      {status === "empty" && <p style={{ color: theme.color.textFaint, marginTop: "1rem" }}>This session has no recorded events.</p>}
      {status === "error" && <p style={{ color: theme.color.danger, marginTop: "1rem" }}>Failed to load the recording.</p>}
      {status === "loaded" && events && (
        <>
          <ReplayPlayer events={events} onReady={setPlayer} />
          <InteractionTimeline events={events} sessionStartedAt={sessionStartedAt} customEvents={customEvents} player={player} />
        </>
      )}
    </div>
  );
}
