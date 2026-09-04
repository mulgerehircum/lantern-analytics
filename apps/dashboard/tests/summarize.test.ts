import { describe, it, expect } from "vitest";
import { summarizeRollups, summarizeMonthlyTrend, summarizeDailyTrend, summarizeSessions, computePeriodComparison } from "../src/lib/summarize";
import type { HourlyRollupItem } from "../src/lib/dynamodb";
import type { SessionRecordingItem } from "../src/lib/sessions";
import type { DashboardSummary } from "../src/lib/summarize";

function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    totalPageviews: 0,
    totalUniques: 0,
    topPages: [],
    referrers: [],
    countries: [],
    devices: [],
    timeSeries: [],
    customEvents: [],
    customEventBreakdown: [],
    ...overrides,
  };
}

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

function session(overrides: Partial<SessionRecordingItem> = {}): SessionRecordingItem {
  return {
    sessionId: "s1",
    startedAt: "2026-08-08T11:00:00.000Z",
    durationMs: 0,
    pageCount: 1,
    storageRef: "ref1",
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

  it("builds a time series sorted by hour, as a real ISO timestamp for each hour bucket", () => {
    const result = summarizeRollups([
      rollup({ SK: "AGG#2026-08-08#14", pageviews: 10 }),
      rollup({ SK: "AGG#2026-08-08#11", pageviews: 4 }),
    ]);
    expect(result.timeSeries).toEqual([
      { hour: "2026-08-08T11:00:00.000Z", pageviews: 4, uniques: 0 },
      { hour: "2026-08-08T14:00:00.000Z", pageviews: 10, uniques: 0 },
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

describe("summarizeDailyTrend", () => {
  it("returns an empty array for no rollups", () => {
    expect(summarizeDailyTrend([])).toEqual([]);
  });

  it("sums pageviews and uniques across hours within the same day", () => {
    const result = summarizeDailyTrend([
      rollup({ SK: "AGG#2026-08-15#11", pageviews: 5, uniques: 3 }),
      rollup({ SK: "AGG#2026-08-15#14", pageviews: 2, uniques: 1 }),
    ]);
    expect(result).toEqual([{ day: "2026-08-15", pageviews: 7, uniques: 4 }]);
  });

  it("keeps different days (even within the same month) separate", () => {
    const result = summarizeDailyTrend([
      rollup({ SK: "AGG#2026-08-15#23", pageviews: 10, uniques: 8 }),
      rollup({ SK: "AGG#2026-08-16#00", pageviews: 4, uniques: 2 }),
    ]);
    expect(result).toEqual([
      { day: "2026-08-15", pageviews: 10, uniques: 8 },
      { day: "2026-08-16", pageviews: 4, uniques: 2 },
    ]);
  });

  it("sorts ascending by day regardless of input order", () => {
    const result = summarizeDailyTrend([
      rollup({ SK: "AGG#2026-08-20#00", pageviews: 1, uniques: 1 }),
      rollup({ SK: "AGG#2026-08-05#00", pageviews: 1, uniques: 1 }),
      rollup({ SK: "AGG#2026-08-12#00", pageviews: 1, uniques: 1 }),
    ]);
    expect(result.map((r) => r.day)).toEqual(["2026-08-05", "2026-08-12", "2026-08-20"]);
  });
});

describe("summarizeSessions", () => {
  it("returns a zeroed-out summary for no sessions", () => {
    expect(summarizeSessions([])).toEqual({
      sessionCount: 0,
      avgDurationSeconds: 0,
      avgPageCount: 0,
      bounceRatePercent: 0,
      longestDurationSeconds: 0,
      topLandingPages: [],
    });
  });

  it("averages duration and page count across sessions", () => {
    const result = summarizeSessions([
      session({ durationMs: 10_000, pageCount: 2 }),
      session({ durationMs: 30_000, pageCount: 4 }),
    ]);
    expect(result.sessionCount).toBe(2);
    expect(result.avgDurationSeconds).toBe(20);
    expect(result.avgPageCount).toBe(3);
  });

  it("computes bounce rate as the percentage of 1-page sessions", () => {
    const result = summarizeSessions([
      session({ pageCount: 1 }),
      session({ pageCount: 1 }),
      session({ pageCount: 1 }),
      session({ pageCount: 5 }),
    ]);
    expect(result.bounceRatePercent).toBe(75);
  });

  it("reports the longest single session's duration", () => {
    const result = summarizeSessions([
      session({ durationMs: 5_000 }),
      session({ durationMs: 120_000 }),
      session({ durationMs: 15_000 }),
    ]);
    expect(result.longestDurationSeconds).toBe(120);
  });

  it("counts landing pages and sorts descending by count", () => {
    const result = summarizeSessions([
      session({ path: "/" }),
      session({ path: "/" }),
      session({ path: "/projects" }),
    ]);
    expect(result.topLandingPages).toEqual([
      { path: "/", count: 2 },
      { path: "/projects", count: 1 },
    ]);
  });

  it("skips sessions with no landing path rather than counting them as an empty-string page", () => {
    const result = summarizeSessions([session({ path: undefined }), session({ path: "/" })]);
    expect(result.topLandingPages).toEqual([{ path: "/", count: 1 }]);
  });

  it("caps landing pages at the top 5", () => {
    const sessions = Array.from({ length: 8 }, (_, i) => session({ path: `/page-${i}` }));
    expect(summarizeSessions(sessions).topLandingPages).toHaveLength(5);
  });
});

describe("computePeriodComparison", () => {
  it("returns null deltas when the previous period had zero", () => {
    const result = computePeriodComparison(summary({ totalPageviews: 10, totalUniques: 5 }), summary());
    expect(result).toEqual({ pageviewsDeltaPercent: null, uniquesDeltaPercent: null });
  });

  it("computes a positive delta", () => {
    const result = computePeriodComparison(
      summary({ totalPageviews: 150, totalUniques: 120 }),
      summary({ totalPageviews: 100, totalUniques: 100 }),
    );
    expect(result).toEqual({ pageviewsDeltaPercent: 50, uniquesDeltaPercent: 20 });
  });

  it("computes a negative delta", () => {
    const result = computePeriodComparison(
      summary({ totalPageviews: 50, totalUniques: 80 }),
      summary({ totalPageviews: 100, totalUniques: 100 }),
    );
    expect(result).toEqual({ pageviewsDeltaPercent: -50, uniquesDeltaPercent: -20 });
  });

  it("rounds to one decimal place", () => {
    const result = computePeriodComparison(summary({ totalPageviews: 10, totalUniques: 0 }), summary({ totalPageviews: 3, totalUniques: 0 }));
    expect(result.pageviewsDeltaPercent).toBe(233.3);
  });

  it("returns 0 (not null) when current equals previous and both are non-zero", () => {
    const result = computePeriodComparison(summary({ totalPageviews: 10 }), summary({ totalPageviews: 10 }));
    expect(result.pageviewsDeltaPercent).toBe(0);
  });
});
