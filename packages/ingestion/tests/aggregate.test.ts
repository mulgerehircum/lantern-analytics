import { describe, it, expect } from "vitest";
import { aggregateEvents, type RawEventItem } from "../src/aggregate";

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

describe("aggregateEvents", () => {
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

  it("counts total pageviews as the event count, including repeats from the same visitor", () => {
    const result = aggregateEvents([event(), event(), event()]);
    expect(result.pageviews).toBe(3);
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

  it("buckets an empty referrer as direct, not as an empty-string key", () => {
    const result = aggregateEvents([event({ referrer: "" })]);
    expect(result.referrers).toEqual({ direct: 1 });
  });

  it("tallies top pages, referrers, countries, and devices independently", () => {
    const result = aggregateEvents([
      event({ path: "/pricing", referrer: "google.com", country: "MD", device: "mobile" }),
      event({ path: "/pricing", referrer: "direct" as never, country: "PL", device: "desktop" }),
      event({ path: "/", referrer: "google.com", country: "MD", device: "desktop" }),
    ]);
    expect(result.topPages).toEqual({ "/pricing": 2, "/": 1 });
    expect(result.referrers).toEqual({ "google.com": 2, direct: 1 });
    expect(result.countries).toEqual({ MD: 2, PL: 1 });
    expect(result.devices).toEqual({ mobile: 1, desktop: 2 });
  });
});
