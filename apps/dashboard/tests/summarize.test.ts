import { describe, it, expect } from "vitest";
import { summarizeRollups } from "../src/lib/summarize";
import type { HourlyRollupItem } from "../src/lib/dynamodb";

function rollup(overrides: Partial<HourlyRollupItem> = {}): HourlyRollupItem {
  return {
    SK: "AGG#2026-08-08#11",
    pageviews: 0,
    uniques: 0,
    topPages: {},
    referrers: {},
    countries: {},
    devices: {},
    ...overrides,
  };
}

describe("summarizeRollups", () => {
  it("returns an empty summary for no rollups", () => {
    const result = summarizeRollups([]);
    expect(result.totalPageviews).toBe(0);
    expect(result.totalUniques).toBe(0);
    expect(result.topPages).toEqual([]);
    expect(result.timeSeries).toEqual([]);
  });

  it("sums pageviews and uniques across hours", () => {
    const result = summarizeRollups([
      rollup({ pageviews: 5, uniques: 3 }),
      rollup({ pageviews: 2, uniques: 1 }),
    ]);
    expect(result.totalPageviews).toBe(7);
    expect(result.totalUniques).toBe(4);
  });

  it("merges top pages across hours and sorts descending by count", () => {
    const result = summarizeRollups([
      rollup({ topPages: { "/": 3, "/pricing": 1 } }),
      rollup({ topPages: { "/pricing": 5 } }),
    ]);
    expect(result.topPages).toEqual([
      { path: "/pricing", count: 6 },
      { path: "/", count: 3 },
    ]);
  });

  it("builds a time series sorted by hour using the SK as the label", () => {
    const result = summarizeRollups([
      rollup({ SK: "AGG#2026-08-08#14", pageviews: 10 }),
      rollup({ SK: "AGG#2026-08-08#11", pageviews: 4 }),
    ]);
    expect(result.timeSeries).toEqual([
      { hour: "2026-08-08#11", pageviews: 4 },
      { hour: "2026-08-08#14", pageviews: 10 },
    ]);
  });
});
