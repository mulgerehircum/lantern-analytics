"use client";

import { useEffect, useRef, useState } from "react";
import "rrweb-player/dist/style.css";
import type RrwebPlayer from "rrweb-player";
import type { eventWithTime } from "@rrweb/types";

/**
 * Construction-only — rrweb-player needs a real DOM node to attach to, so
 * this can't be server-rendered. Fetching the recording and owning
 * loading/empty/error status lives one level up in SessionReplay.tsx, which
 * also renders InteractionTimeline alongside this from the *same* fetched
 * `events` — keeping the fetch here would mean either a second network
 * round-trip or threading data back out for no reason. `onReady` hands the
 * constructed player instance up so SessionReplay can call `.goto()` (seek
 * deep-links) and InteractionTimeline can call `.getReplayer().getMirror()`
 * (resolve click ids to real elements).
 *
 * `events` must be a referentially-stable array from the caller (set once
 * after fetch, not recreated each render) — the mount effect depends on it,
 * and a fresh array reference every render would spuriously reconstruct the
 * player.
 */
export function ReplayPlayer({
  events,
  onReady,
}: {
  events: eventWithTime[];
  onReady?: (player: RrwebPlayer) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function mount() {
      const { default: RrwebPlayerCtor } = await import("rrweb-player");
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
      // containerRef.current is `display: none` until `ready`, which only
      // flips *after* this measurement, and a display:none element's
      // clientWidth is always 0 regardless of its would-be layout width.
      // That 0 silently tripped the `|| 1000` fallback every time,
      // defeating the whole fix. The parent (this component's own root
      // <div>) is never conditionally hidden — SessionReplay only mounts
      // ReplayPlayer once `events` is already non-empty — so it reliably
      // reflects the real available width.
      const width = Math.min(containerRef.current.parentElement?.clientWidth || 1000, 1000);
      const height = Math.round(width * 0.6);

      containerRef.current.innerHTML = "";
      const player = new RrwebPlayerCtor({
        target: containerRef.current,
        props: { events, width, height },
      });
      setReady(true);
      onReady?.(player);
    }

    void mount();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // The container div is always mounted (never conditionally omitted) so
  // `containerRef.current` is already a real DOM node by the time the async
  // mount() above tries to attach the player to it — attaching only once
  // `ready` flips would be too late, since that flip happens after the
  // player is already constructed against this ref.
  return (
    <div>
      {/* rrweb-player's own bundled CSS floats .rr-player (`float: left`) —
          harmless on its own demo page, but a floated child is removed from
          normal flow for its parent's height calculation, so an un-cleared
          parent collapses to 0 height while the floated player still
          renders at full size, visually escaping the collapsed box instead
          of appearing contained within it. `display: flex` (rather than
          flow-root) both contains the float — flex items ignore `float`
          per spec, converting it to `none` — and lets justifyContent center
          the player. Centering matters because the width computed above,
          taken before the player exists, can end up a handful of pixels
          off from the container's true post-layout width (e.g. if a
          scrollbar appears only once the player is inserted) — flex
          centering makes any such small mismatch symmetric and invisible
          instead of all the slack landing on one side. */}
      <div ref={containerRef} style={{ display: ready ? "flex" : "none", justifyContent: "center" }} />
    </div>
  );
}
