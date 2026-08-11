import { describe, it, expect } from "vitest";
import {
  currentMonth,
  shiftMonth,
  formatMonthLabel,
  isDayPeriod,
  parentMonth,
  currentDay,
  shiftDay,
  formatDayLabel,
  isHourPeriod,
  parentDay,
  currentHour,
  shiftHour,
  formatHourLabel,
} from "../src/lib/months";

describe("currentMonth", () => {
  it("formats a given date as YYYY-MM", () => {
    expect(currentMonth(new Date("2026-08-15T12:00:00.000Z"))).toBe("2026-08");
  });

  it("pads single-digit months", () => {
    expect(currentMonth(new Date("2026-03-01T00:00:00.000Z"))).toBe("2026-03");
  });
});

describe("shiftMonth", () => {
  it("moves forward within a year", () => {
    expect(shiftMonth("2026-08", 1)).toBe("2026-09");
  });

  it("moves backward within a year", () => {
    expect(shiftMonth("2026-08", -1)).toBe("2026-07");
  });

  it("rolls over into the next year", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("rolls back into the previous year", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("handles multi-month shifts spanning a year boundary", () => {
    expect(shiftMonth("2026-11", 3)).toBe("2027-02");
    expect(shiftMonth("2026-02", -3)).toBe("2025-11");
  });

  it("handles a zero shift as a no-op", () => {
    expect(shiftMonth("2026-08", 0)).toBe("2026-08");
  });
});

describe("formatMonthLabel", () => {
  it("formats a month string as a human-readable label", () => {
    expect(formatMonthLabel("2026-08")).toBe("August 2026");
  });

  it("formats January correctly (index-off-by-one regression guard)", () => {
    expect(formatMonthLabel("2026-01")).toBe("January 2026");
  });

  it("formats December correctly", () => {
    expect(formatMonthLabel("2026-12")).toBe("December 2026");
  });
});

describe("isDayPeriod", () => {
  it("is true for a YYYY-MM-DD string", () => {
    expect(isDayPeriod("2026-08-15")).toBe(true);
  });

  it("is false for a YYYY-MM string", () => {
    expect(isDayPeriod("2026-08")).toBe(false);
  });

  it("is false for garbage input", () => {
    expect(isDayPeriod("not-a-date")).toBe(false);
    expect(isDayPeriod("")).toBe(false);
  });
});

describe("parentMonth", () => {
  it("extracts the month from a day string", () => {
    expect(parentMonth("2026-08-15")).toBe("2026-08");
  });
});

describe("currentDay", () => {
  it("formats a given date as YYYY-MM-DD", () => {
    expect(currentDay(new Date("2026-08-15T23:59:59.000Z"))).toBe("2026-08-15");
  });
});

describe("shiftDay", () => {
  it("moves forward within a month", () => {
    expect(shiftDay("2026-08-15", 1)).toBe("2026-08-16");
  });

  it("moves backward within a month", () => {
    expect(shiftDay("2026-08-15", -1)).toBe("2026-08-14");
  });

  it("rolls over into the next month", () => {
    expect(shiftDay("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("rolls back into the previous month", () => {
    expect(shiftDay("2026-09-01", -1)).toBe("2026-08-31");
  });

  it("rolls over a year boundary", () => {
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles leap-year February correctly", () => {
    expect(shiftDay("2028-02-28", 1)).toBe("2028-02-29"); // 2028 is a leap year
    expect(shiftDay("2028-02-29", 1)).toBe("2028-03-01");
  });
});

describe("formatDayLabel", () => {
  it("formats a day string as a human-readable label", () => {
    expect(formatDayLabel("2026-08-15")).toBe("August 15, 2026");
  });

  it("formats January 1st correctly (index-off-by-one regression guard)", () => {
    expect(formatDayLabel("2026-01-01")).toBe("January 1, 2026");
  });
});

describe("isHourPeriod", () => {
  it("is true for an hour string", () => {
    expect(isHourPeriod("2026-08-15T14")).toBe(true);
  });

  it("is false for a day string", () => {
    expect(isHourPeriod("2026-08-15")).toBe(false);
  });

  it("is false for a month string", () => {
    expect(isHourPeriod("2026-08")).toBe(false);
  });

  it("is false for garbage input", () => {
    expect(isHourPeriod("not-a-date")).toBe(false);
    expect(isHourPeriod("")).toBe(false);
  });
});

describe("parentDay", () => {
  it("returns the day an hour belongs to", () => {
    expect(parentDay("2026-08-15T14")).toBe("2026-08-15");
  });
});

describe("currentHour", () => {
  it("formats a given date as YYYY-MM-DDTHH", () => {
    expect(currentHour(new Date("2026-08-15T14:37:00.000Z"))).toBe("2026-08-15T14");
  });
});

describe("shiftHour", () => {
  it("shifts forward within the same day", () => {
    expect(shiftHour("2026-08-15T14", 1)).toBe("2026-08-15T15");
  });

  it("shifts backward within the same day", () => {
    expect(shiftHour("2026-08-15T14", -1)).toBe("2026-08-15T13");
  });

  it("rolls over into the next day at 23", () => {
    expect(shiftHour("2026-08-15T23", 1)).toBe("2026-08-16T00");
  });

  it("rolls back into the previous day at 00", () => {
    expect(shiftHour("2026-08-16T00", -1)).toBe("2026-08-15T23");
  });

  it("rolls over into the next month/year at a month boundary", () => {
    expect(shiftHour("2026-12-31T23", 1)).toBe("2027-01-01T00");
  });
});

describe("formatHourLabel", () => {
  it("formats an hour string as a UTC-labeled human-readable string", () => {
    expect(formatHourLabel("2026-08-15T14")).toBe("August 15, 2026, 14:00 UTC");
  });
});
