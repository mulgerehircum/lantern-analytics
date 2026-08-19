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
        // point upscaling past the original) avoids the mismatch entirely.
        //
        // Measure the PARENT's width, not containerRef.current's own —
        // containerRef.current is `display: none` for the entire "loading"
        // state (it only flips to "block" once status becomes "ready",
        // which happens *after* this measurement), and a display:none
        // element's clientWidth is always 0 regardless of its would-be
        // layout width. That 0 silently tripped the `|| 1000` fallback
        // every time, defeating the whole fix. The parent (ReplayPlayer's
        // own root <div>) is never conditionally hidden, so it reliably
        // reflects the real available width.
        const width = Math.min(containerRef.current.parentElement?.clientWidth || 1000, 1000);
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
      {/* rrweb-player's own bundled CSS floats .rr-player (`float: left`) —
          harmless on its own demo page, but a floated child is removed from
          normal flow for its parent's height calculation, so an un-cleared
          parent collapses to 0 height while the floated player still
          renders at full size, visually escaping the collapsed box instead
          of appearing contained within it. display:flow-root establishes a
          new block formatting context, which properly contains floated
          descendants (the modern equivalent of an old-school clearfix)
          without any of overflow:hidden's clipping side effects. */}
      <div ref={containerRef} style={{ marginTop: "1rem", display: status === "ready" ? "flow-root" : "none" }} />
    </div>
  );
}
