import { describe, expect, it } from "vitest";
import { extractHeatmapClicks, buildHeatmapGrid } from "../src/lib/heatmap";
import type { RawEventRecordWithKey } from "../src/lib/dynamodb";
import { HEATMAP_CLICK_EVENT_NAME } from "@lantern/shared";

function event(overrides: Partial<RawEventRecordWithKey> & { SK: string }): RawEventRecordWithKey {
  return {
    path: "/",
    country: "US",
    device: "desktop",
    visitorHash: "v1",
    ...overrides,
  };
}

describe("extractHeatmapClicks", () => {
  it("extracts xPct/yPct for matching name and path", () => {
    const events = [event({ SK: "EVENT#1", name: HEATMAP_CLICK_EVENT_NAME, path: "/", metadata: { xPct: 40, yPct: 60 } })];
    expect(extractHeatmapClicks(events, "/")).toEqual([{ xPct: 40, yPct: 60 }]);
  });

  it("ignores events with a different name", () => {
    const events = [event({ SK: "EVENT#1", name: "contact_click", path: "/", metadata: { xPct: 40, yPct: 60 } })];
    expect(extractHeatmapClicks(events, "/")).toEqual([]);
  });

  it("ignores events on a different path", () => {
    const events = [event({ SK: "EVENT#1", name: HEATMAP_CLICK_EVENT_NAME, path: "/other", metadata: { xPct: 40, yPct: 60 } })];
    expect(extractHeatmapClicks(events, "/")).toEqual([]);
  });

  it("drops events with missing or non-finite coordinates", () => {
    const events = [
      event({ SK: "EVENT#1", name: HEATMAP_CLICK_EVENT_NAME, path: "/", metadata: {} }),
      event({ SK: "EVENT#2", name: HEATMAP_CLICK_EVENT_NAME, path: "/", metadata: { xPct: "not a number", yPct: 10 } }),
    ];
    expect(extractHeatmapClicks(events, "/")).toEqual([]);
  });
});

describe("buildHeatmapGrid", () => {
  it("buckets points into the correct cell", () => {
    const grid = buildHeatmapGrid([{ xPct: 5, yPct: 5 }], 20, 20);
    expect(grid.counts[1][1]).toBe(1);
    expect(grid.maxCount).toBe(1);
  });

  it("clamps a 100% coordinate into the last cell, not out of bounds", () => {
    const grid = buildHeatmapGrid([{ xPct: 100, yPct: 100 }], 20, 20);
    expect(grid.counts[19][19]).toBe(1);
  });

  it("tracks maxCount across multiple points in the same cell", () => {
    const grid = buildHeatmapGrid(
      [
        { xPct: 5, yPct: 5 },
        { xPct: 5, yPct: 5 },
        { xPct: 90, yPct: 90 },
      ],
      20,
      20,
    );
    expect(grid.counts[1][1]).toBe(2);
    expect(grid.maxCount).toBe(2);
  });

  it("returns an all-zero grid for empty input", () => {
    const grid = buildHeatmapGrid([], 5, 5);
    expect(grid.maxCount).toBe(0);
    expect(grid.counts).toHaveLength(5);
    expect(grid.counts[0]).toHaveLength(5);
    expect(grid.counts.flat().every((c) => c === 0)).toBe(true);
  });
});
