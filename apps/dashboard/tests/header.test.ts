import { describe, it, expect } from "vitest";
import {
  formatMonthRangeLabel,
  formatMonthRangeShort,
  formatDayRangeLabel,
  formatHourRangeLabel,
  formatHeaderRangeLabel,
  headerGranularityLabel,
  prevNextPeriod,
  buildOverviewCsv,
} from "../src/lib/header";

describe("formatMonthRangeLabel", () => {
  it("formats a 30-day month as a hyphen-joined range", () => {
    expect(formatMonthRangeLabel("2026-09")).toBe("Sep 1, 2026 - Sep 30, 2026");
  });

  it("uses the correct last day for February in a leap year", () => {
    expect(formatMonthRangeLabel("2028-02")).toBe("Feb 1, 2028 - Feb 29, 2028");
  });

  it("never contains en/em dashes", () => {
    expect(formatMonthRangeLabel("2026-09")).not.toMatch(/[–—]/);
  });
});

describe("formatMonthRangeShort", () => {
  it("formats a month as a compact hyphen range", () => {
    expect(formatMonthRangeShort("2026-09")).toBe("Sep 1 - Sep 30, 2026");
  });

  it("never contains en/em dashes", () => {
    expect(formatMonthRangeShort("2026-09")).not.toMatch(/[–—]/);
  });
});

describe("headerGranularityLabel", () => {
  it("labels each drill depth", () => {
    expect(headerGranularityLabel(undefined, false, false)).toBe("Monthly");
    expect(headerGranularityLabel("2026-09", false, false)).toBe("Daily");
    expect(headerGranularityLabel("2026-09-15", true, false)).toBe("Hourly");
    expect(headerGranularityLabel("2026-09-15T14", false, true)).toBe("Hourly");
  });
});

describe("formatDayRangeLabel", () => {
  it("formats a day without a range", () => {
    expect(formatDayRangeLabel("2026-09-15")).toBe("Sep 15, 2026");
  });
});

describe("formatHourRangeLabel", () => {
  it("formats an hour as a one-hour window", () => {
    expect(formatHourRangeLabel("2026-09-15T14")).toBe("Sep 15, 2026, 14:00 - 15:00");
  });

  it("rolls the window over midnight", () => {
    expect(formatHourRangeLabel("2026-09-15T23")).toBe("Sep 15, 2026, 23:00 - 00:00");
  });
});

describe("formatHeaderRangeLabel", () => {
  it("returns All time when no period is selected", () => {
    expect(formatHeaderRangeLabel(undefined, false, false)).toBe("All time");
  });

  it("dispatches on drill depth", () => {
    expect(formatHeaderRangeLabel("2026-09", false, false)).toBe("Sep 1, 2026 - Sep 30, 2026");
    expect(formatHeaderRangeLabel("2026-09-15", true, false)).toBe("Sep 15, 2026");
    expect(formatHeaderRangeLabel("2026-09-15T14", false, true)).toBe("Sep 15, 2026, 14:00 - 15:00");
  });
});

describe("prevNextPeriod", () => {
  it("returns null at all-time", () => {
    expect(prevNextPeriod(undefined, false, false)).toBeNull();
  });

  it("steps months", () => {
    expect(prevNextPeriod("2026-09", false, false)).toEqual({ prev: "2026-08", next: "2026-10" });
  });

  it("steps days across a month boundary", () => {
    expect(prevNextPeriod("2026-09-01", true, false)).toEqual({ prev: "2026-08-31", next: "2026-09-02" });
  });

  it("steps hours across midnight", () => {
    expect(prevNextPeriod("2026-09-15T00", false, true)).toEqual({ prev: "2026-09-14T23", next: "2026-09-15T01" });
  });
});

describe("buildOverviewCsv", () => {
  it("emits summary plus breakdown sections", () => {
    const csv = buildOverviewCsv({
      periodLabel: "Sep 1, 2026 - Sep 30, 2026",
      pageviews: 48,
      uniques: 46,
      topPages: [{ path: "/", count: 20 }],
      referrers: [{ referrer: "github.com", count: 13 }],
      countries: [{ country: "US", count: 10 }],
    });
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Section,Key,Value");
    expect(lines).toContain("Summary,Period,\"Sep 1, 2026 - Sep 30, 2026\"");
    expect(lines).toContain("Summary,Pageviews,48");
    expect(lines).toContain("Top pages,/,20");
    expect(lines).toContain("Referrers,github.com,13");
    expect(lines).toContain("Countries,US,10");
  });

  it("escapes fields containing commas or quotes", () => {
    const csv = buildOverviewCsv({
      periodLabel: "All time",
      pageviews: 1,
      uniques: 1,
      topPages: [{ path: '/a,"b"', count: 1 }],
      referrers: [],
      countries: [],
    });
    expect(csv).toContain('Top pages,"/a,""b""",1');
  });
});
