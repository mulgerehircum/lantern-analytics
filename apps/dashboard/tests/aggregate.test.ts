import { describe, it, expect } from "vitest";
import { aggregateEvents, type RawEventItem } from "../src/lib/aggregate";

function event(overrides: Partial<RawEventItem> = {}): RawEventItem {
  return {
    path: "/",
    referrer: "",
    country: "unknown",
    device: "desktop",
    visitorHash: "hash-a",
    ...overrides,
  };
}

describe("aggregateEvents (dashboard copy, mirrors ingestion's)", () => {
  it("returns all-zero shape for no events", () => {
    expect(aggregateEvents([])).toEqual({
      pageviews: 0,
      uniques: 0,
      topPages: {},
      referrers: {},
      countries: {},
      devices: {},
    });
  });

  it("counts uniques by distinct visitorHash, not by event count", () => {
    const result = aggregateEvents([
      event({ visitorHash: "a" }),
      event({ visitorHash: "a" }),
      event({ visitorHash: "b" }),
    ]);
    expect(result.pageviews).toBe(3);
    expect(result.uniques).toBe(2);
  });

  it("buckets an empty referrer as direct", () => {
    expect(aggregateEvents([event({ referrer: "" })]).referrers).toEqual({ direct: 1 });
  });
});
