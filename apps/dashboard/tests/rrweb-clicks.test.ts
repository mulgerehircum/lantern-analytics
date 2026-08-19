import { describe, it, expect } from "vitest";
import { EventType, IncrementalSource, MouseInteractions } from "@rrweb/types";
import type { eventWithTime } from "@rrweb/types";
import { extractRawClicks } from "../src/lib/rrweb-clicks";

function mouseInteractionEvent(
  type: MouseInteractions,
  overrides: { id?: number; timestamp?: number; x?: number; y?: number } = {},
): eventWithTime {
  return {
    type: EventType.IncrementalSnapshot,
    timestamp: overrides.timestamp ?? 1000,
    data: {
      source: IncrementalSource.MouseInteraction,
      type,
      id: overrides.id ?? 42,
      x: overrides.x,
      y: overrides.y,
    },
  } as eventWithTime;
}

describe("extractRawClicks", () => {
  it("extracts a Click event with its id/timestamp/coordinates", () => {
    const events = [mouseInteractionEvent(MouseInteractions.Click, { id: 7, timestamp: 5000, x: 10, y: 20 })];
    expect(extractRawClicks(events)).toEqual([{ id: 7, timestampMs: 5000, x: 10, y: 20 }]);
  });

  it("excludes DblClick", () => {
    expect(extractRawClicks([mouseInteractionEvent(MouseInteractions.DblClick)])).toEqual([]);
  });

  it.each([
    ["MouseUp", MouseInteractions.MouseUp],
    ["MouseDown", MouseInteractions.MouseDown],
    ["Focus", MouseInteractions.Focus],
    ["Blur", MouseInteractions.Blur],
    ["ContextMenu", MouseInteractions.ContextMenu],
  ])("excludes %s", (_label, type) => {
    expect(extractRawClicks([mouseInteractionEvent(type)])).toEqual([]);
  });

  it("excludes non-MouseInteraction incremental sources (e.g. Mutation, MouseMove, Scroll)", () => {
    const events: eventWithTime[] = [
      { type: EventType.IncrementalSnapshot, timestamp: 1, data: { source: IncrementalSource.Mutation, texts: [], attributes: [], removes: [], adds: [] } } as eventWithTime,
      { type: EventType.IncrementalSnapshot, timestamp: 2, data: { source: IncrementalSource.MouseMove, positions: [] } } as eventWithTime,
      { type: EventType.IncrementalSnapshot, timestamp: 3, data: { source: IncrementalSource.Scroll, id: 1, x: 0, y: 0 } } as eventWithTime,
    ];
    expect(extractRawClicks(events)).toEqual([]);
  });

  it("excludes non-IncrementalSnapshot event types (Meta, FullSnapshot, Custom)", () => {
    const events: eventWithTime[] = [
      { type: EventType.Meta, timestamp: 1, data: { href: "", width: 0, height: 0 } } as eventWithTime,
      { type: EventType.FullSnapshot, timestamp: 2, data: { node: {} as never, initialOffset: { top: 0, left: 0 } } } as eventWithTime,
      { type: EventType.Custom, timestamp: 3, data: { tag: "x", payload: {} } } as eventWithTime,
    ];
    expect(extractRawClicks(events)).toEqual([]);
  });

  it("returns [] for an empty event list", () => {
    expect(extractRawClicks([])).toEqual([]);
  });

  it("extracts multiple clicks in order", () => {
    const events = [
      mouseInteractionEvent(MouseInteractions.Click, { id: 1, timestamp: 100 }),
      mouseInteractionEvent(MouseInteractions.Click, { id: 2, timestamp: 200 }),
    ];
    expect(extractRawClicks(events).map((c) => c.id)).toEqual([1, 2]);
  });
});
