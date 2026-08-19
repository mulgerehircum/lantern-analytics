import { EventType, IncrementalSource, MouseInteractions } from "@rrweb/types";
import type { eventWithTime } from "@rrweb/types";

export interface RawClick {
  /** The rrweb mirror node id — resolve via Replayer.getMirror().getNode(id) to get the actual clicked element. */
  id: number;
  /** Absolute epoch ms, same units as the event's own `timestamp`. */
  timestampMs: number;
  x?: number;
  y?: number;
}

/**
 * Click-only, deliberately: a DblClick already fires a preceding Click at
 * the same id/coordinates (including both would double-count the same
 * real-world click), and MouseUp/MouseDown/Focus/Blur/ContextMenu/touch
 * variants are noise for a "what got clicked" timeline. Pure and DOM-free —
 * resolving `id` to an actual element (tag/text/href) needs a live rrweb
 * Replayer's mirror, which only exists client-side after the player has
 * mounted; that resolution step lives in InteractionTimeline.tsx, not here.
 */
export function extractRawClicks(events: eventWithTime[]): RawClick[] {
  const clicks: RawClick[] = [];
  for (const event of events) {
    if (event.type !== EventType.IncrementalSnapshot) continue;
    const data = event.data;
    if (data.source !== IncrementalSource.MouseInteraction) continue;
    if (data.type !== MouseInteractions.Click) continue;
    clicks.push({ id: data.id, timestampMs: event.timestamp, x: data.x, y: data.y });
  }
  return clicks;
}
