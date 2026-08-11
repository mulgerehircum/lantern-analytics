import { describe, it, expect } from "vitest";
import { summarizeRollups, summarizeMonthlyTrend } from "../src/lib/summarize";
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

  it("merges custom-event totals across hours and sorts descending", () => {
    const result = summarizeRollups([
      rollup({ customEvents: { contact_click: 2, cv_download: 1 } }),
      rollup({ customEvents: { contact_click: 3, section_view: 5 } }),
    ]);
    expect(result.customEvents).toEqual([
      { name: "contact_click", count: 5 },
      { name: "section_view", count: 5 },
      { name: "cv_download", count: 1 },
    ]);
  });

  it("merges and flattens dimension breakdowns across hours", () => {
    const result = summarizeRollups([
      rollup({
        eventDimensions: {
          project_link_click: { project_title: { PDFloom: 2 } },
        },
      }),
      rollup({
        eventDimensions: {
          project_link_click: { project_title: { PDFloom: 1, Dataroom: 4 } },
          project_filter: { tech: { React: 3 } },
        },
      }),
    ]);
    expect(result.customEventBreakdown).toEqual([
      { name: "project_link_click", dimension: "project_title", value: "Dataroom", count: 4 },
      { name: "project_filter", dimension: "tech", value: "React", count: 3 },
      { name: "project_link_click", dimension: "project_title", value: "PDFloom", count: 3 },
    ]);
  });

  it("treats rollups written before custom events existed as empty for the new fields", () => {
    const result = summarizeRollups([
      rollup({ pageviews: 3 }),
      rollup({ pageviews: 1, customEvents: { click: 2 } }),
    ]);
    expect(result.customEvents).toEqual([{ name: "click", count: 2 }]);
    expect(result.customEventBreakdown).toEqual([]);
  });
});

describe("summarizeMonthlyTrend", () => {
  it("returns an empty array for no rollups", () => {
    expect(summarizeMonthlyTrend([])).toEqual([]);
  });

  it("sums pageviews and uniques across hours within the same month", () => {
    const result = summarizeMonthlyTrend([
      rollup({ SK: "AGG#2026-08-08#11", pageviews: 5, uniques: 3 }),
      rollup({ SK: "AGG#2026-08-15#14", pageviews: 2, uniques: 1 }),
    ]);
    expect(result).toEqual([{ month: "2026-08", pageviews: 7, uniques: 4 }]);
  });

  it("keeps different months separate", () => {
    const result = summarizeMonthlyTrend([
      rollup({ SK: "AGG#2026-07-31#23", pageviews: 10, uniques: 8 }),
      rollup({ SK: "AGG#2026-08-01#00", pageviews: 4, uniques: 2 }),
    ]);
    expect(result).toEqual([
      { month: "2026-07", pageviews: 10, uniques: 8 },
      { month: "2026-08", pageviews: 4, uniques: 2 },
    ]);
  });

  it("sorts ascending by month regardless of input order", () => {
    const result = summarizeMonthlyTrend([
      rollup({ SK: "AGG#2026-09-01#00", pageviews: 1, uniques: 1 }),
      rollup({ SK: "AGG#2026-07-01#00", pageviews: 1, uniques: 1 }),
      rollup({ SK: "AGG#2026-08-01#00", pageviews: 1, uniques: 1 }),
    ]);
    expect(result.map((r) => r.month)).toEqual(["2026-07", "2026-08", "2026-09"]);
  });
});
