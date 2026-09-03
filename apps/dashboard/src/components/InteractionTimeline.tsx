"use client";

import { useEffect, useMemo, useState } from "react";
import type RrwebPlayer from "rrweb-player";
import type { eventWithTime } from "@rrweb/types";
import { theme } from "@/lib/theme";
import { extractRawClicks } from "@/lib/rrweb-clicks";
import { mergeInteractionTimeline } from "@/lib/interaction-timeline";
import type { CustomEventTimelineInput, RrwebClickTimelineInput } from "@/lib/interaction-timeline";

/**
 * Resolves a rrweb mirror node to a short human label. `null` means the id
 * was never rebuilt into the live DOM (stale/pruned id, or a click that
 * predates enough of the recording being processed) - that click gets
 * dropped from the timeline entirely rather than shown as a placeholder.
 */
function buildClickLabel(node: Node | null): string | null {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const ariaLabel = el.getAttribute("aria-label")?.trim();
  if (ariaLabel) return `${tag}: ${ariaLabel.slice(0, 40)}`;
  const text = el.textContent?.trim().replace(/\s+/g, " ").slice(0, 40);
  if (tag === "a") {
    const href = el.getAttribute("href");
    return text ? `Link: ${text}` : href ? `Link: ${href}` : "Link click";
  }
  return text ? `${tag}: ${text}` : `${tag} click`;
}

function formatOffset(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Merged, clickable interaction list for a session's replay: custom-event
 * tracking (rich labels) plus rrweb-reconstructed clicks (full coverage,
 * generic labels), deduped - see lib/interaction-timeline.ts. Click resolution
 * (mirror.getNode) only works once the player has mounted enough of the
 * recording to have built its live DOM, so this renders nothing until
 * `player` is non-null.
 */
export function InteractionTimeline({
  events,
  sessionStartedAt,
  customEvents,
  player,
}: {
  events: eventWithTime[];
  sessionStartedAt: string;
  customEvents: CustomEventTimelineInput[];
  player: RrwebPlayer | null;
}) {
  const rawClicks = useMemo(() => extractRawClicks(events), [events]);
  const [resolvedClicks, setResolvedClicks] = useState<RrwebClickTimelineInput[] | null>(null);

  useEffect(() => {
    if (!player) return;
    const sessionStartMs = Date.parse(sessionStartedAt);
    const mirror = player.getReplayer().getMirror();
    const resolved: RrwebClickTimelineInput[] = [];
    for (const click of rawClicks) {
      const label = buildClickLabel(mirror.getNode(click.id));
      if (!label) continue;
      resolved.push({ offsetMs: click.timestampMs - sessionStartMs, label });
    }
    setResolvedClicks(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, rawClicks]);

  if (!resolvedClicks) return null;

  const timeline = mergeInteractionTimeline(customEvents, resolvedClicks);

  // This panel lives nested inside the session-detail page's dark "theater"
  // box (a fixed oklch(0.22...) background used for the video regardless of
  // the dashboard's own light/dark mode toggle) - theme.color.* text tokens
  // are calibrated for the *light* card background used everywhere else in
  // the app and would be near-invisible here, so this uses its own
  // dark-panel-appropriate palette instead of the shared theme tokens.
  return (
    <div style={{ marginTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: "0.8rem" }}>
      <div style={{ fontWeight: theme.font.weight.semibold, fontSize: "0.85rem", marginBottom: "0.5rem", color: "rgba(255,255,255,0.85)" }}>
        Interactions
      </div>
      {timeline.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.82rem", margin: 0 }}>No clicks recorded.</p>
      ) : (
        timeline.map((entry, i) => (
          <button
            key={i}
            type="button"
            onClick={() => player?.goto(entry.offsetMs, false)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              padding: "0.35rem 0.25rem",
              border: "none",
              background: "none",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              fontSize: "0.82rem",
              cursor: "pointer",
              textAlign: "left",
              color: entry.source === "custom-event" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: "0.6rem" }}>{entry.label}</span>
            <span style={{ flexShrink: 0, fontWeight: theme.font.weight.semibold, color: theme.color.brand }}>{formatOffset(entry.offsetMs)}</span>
          </button>
        ))
      )}
    </div>
  );
}
