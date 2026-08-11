"use client";

import { useEffect, useRef, useState } from "react";
import "rrweb-player/dist/style.css";

/**
 * The dashboard's first client component — rrweb-player needs a real DOM
 * node to attach to, so this can't be server-rendered. Fetches the recorded
 * event stream from the dashboard's own /api/recordings route (never the
 * Mac-mini receiver directly — see that route's doc comment) and hands it to
 * rrweb-player, which owns playback controls (play/pause/scrub) itself.
 */
export function ReplayPlayer({ siteId, sessionId }: { siteId: string; sessionId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "empty" | "error" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/recordings?siteId=${encodeURIComponent(siteId)}&sessionId=${encodeURIComponent(sessionId)}`);
        if (!res.ok) {
          if (!cancelled) setStatus("error");
          return;
        }
        const data: { events?: unknown[] } = await res.json();
        if (cancelled) return;

        if (!data.events || data.events.length === 0) {
          setStatus("empty");
          return;
        }

        const { default: RrwebPlayer } = await import("rrweb-player");
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = "";
        new RrwebPlayer({
          target: containerRef.current,
          props: { events: data.events, width: 1000, height: 600 },
        });
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [siteId, sessionId]);

  // The container div is always mounted (never conditionally omitted) so
  // `containerRef.current` is already a real DOM node by the time the async
  // load() above tries to attach the player to it — attaching only once
  // status flips to "ready" would be too late, since that flip happens after
  // the player is already constructed against this ref.
  return (
    <div>
      {status === "loading" && <p style={{ color: "#999", marginTop: "1rem" }}>Loading recording…</p>}
      {status === "empty" && <p style={{ color: "#999", marginTop: "1rem" }}>This session has no recorded events.</p>}
      {status === "error" && <p style={{ color: "#b45309", marginTop: "1rem" }}>Failed to load the recording.</p>}
      <div ref={containerRef} style={{ marginTop: "1rem", display: status === "ready" ? "block" : "none" }} />
    </div>
  );
}
