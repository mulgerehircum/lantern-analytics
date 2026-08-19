export interface CustomEventTimelineInput {
  offsetMs: number;
  name: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface RrwebClickTimelineInput {
  offsetMs: number;
  label: string;
}

export interface TimelineEntry {
  offsetMs: number;
  label: string;
  source: "custom-event" | "rrweb-click";
}

/** No metadata -> the bare event name. With metadata -> name + up to the first two values, in insertion order. */
export function formatCustomEventLabel(name: string, metadata?: Record<string, string | number | boolean>): string {
  if (!metadata) return name;
  const parts = Object.values(metadata).slice(0, 2);
  return parts.length ? `${name} (${parts.join(", ")})` : name;
}

/**
 * Merges the server-correlated custom-event list (rich labels, from
 * lib/session-correlation.ts's session→events direction) with the
 * client-extracted rrweb click list (generic labels, full click coverage)
 * into one chronological timeline. A rrweb click within `windowMs` of a
 * custom event is treated as the same real-world click and dropped — the
 * custom event's richer label wins. Both are kept when farther apart than
 * that. Pure; sorted ascending by offsetMs.
 */
export function mergeInteractionTimeline(
  customEvents: CustomEventTimelineInput[],
  rrwebClicks: RrwebClickTimelineInput[],
  windowMs: number = 1000,
): TimelineEntry[] {
  const customEntries: TimelineEntry[] = customEvents
    .map((e) => ({ offsetMs: e.offsetMs, label: formatCustomEventLabel(e.name, e.metadata), source: "custom-event" as const }))
    .sort((a, b) => a.offsetMs - b.offsetMs);

  const clickEntries: TimelineEntry[] = rrwebClicks
    .filter((click) => !customEntries.some((custom) => Math.abs(custom.offsetMs - click.offsetMs) <= windowMs))
    .map((click) => ({ offsetMs: click.offsetMs, label: click.label, source: "rrweb-click" as const }));

  return [...customEntries, ...clickEntries].sort((a, b) => a.offsetMs - b.offsetMs);
}
