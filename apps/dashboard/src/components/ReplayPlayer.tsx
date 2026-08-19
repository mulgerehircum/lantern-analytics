"use client";

import { useEffect, useRef, useState } from "react";
import "rrweb-player/dist/style.css";
import { theme } from "@/lib/theme";

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

        // rrweb-player renders at a fixed pixel size chosen at construction
        // time — it does not resize itself afterward. A hardcoded 1000×600
        // used to be wrapped in a CSS `aspect-ratio` + `overflow: hidden`
        // container to fit the design, but 1000:600 (5:3, and the player
        // adds its own ~80px controller bar below that, making the real
        // rendered box 1000×680, ~1.47:1) never matched the container's
        // aspect-ratio — the fixed-size player just got silently clipped.
        // Sizing to the actual available width up front (capped at 1000, no
        // point upscaling past the original) avoids the mismatch entirely;
        // a block-level empty div's width already equals its parent's
        // content width per normal CSS flow, so this is accurate even
        // though nothing has been rendered into it yet.
        const width = Math.min(containerRef.current.clientWidth || 1000, 1000);
        const height = Math.round(width * 0.6);

        containerRef.current.innerHTML = "";
        new RrwebPlayer({
          target: containerRef.current,
          props: { events: data.events, width, height },
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
      {status === "loading" && <p style={{ color: theme.color.textFaint, marginTop: "1rem" }}>Loading recording…</p>}
      {status === "empty" && <p style={{ color: theme.color.textFaint, marginTop: "1rem" }}>This session has no recorded events.</p>}
      {status === "error" && <p style={{ color: theme.color.danger, marginTop: "1rem" }}>Failed to load the recording.</p>}
      <div ref={containerRef} style={{ marginTop: "1rem", display: status === "ready" ? "block" : "none" }} />
    </div>
  );
}
