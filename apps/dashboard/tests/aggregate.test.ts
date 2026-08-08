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
      customEvents: {},
      eventDimensions: {},
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

  it("counts custom events by name, keeping them out of pageview/uniques totals", () => {
    const result = aggregateEvents([
      event({ name: "contact_click", metadata: { platform: "email" }, referrer: undefined }),
      event({ name: "contact_click", metadata: { platform: "email" }, referrer: undefined }),
      event({ visitorHash: "a" }),
    ]);
    expect(result.pageviews).toBe(1);
    expect(result.uniques).toBe(1);
    expect(result.customEvents).toEqual({ contact_click: 2 });
  });

  it("rolls up string metadata values into per-name dimension counts", () => {
    const result = aggregateEvents([
      event({ name: "project_link_click", metadata: { project_title: "PDFloom", link_type: "github" }, referrer: undefined }),
      event({ name: "project_filter", metadata: { tech: "React" }, referrer: undefined }),
    ]);
    expect(result.eventDimensions).toEqual({
      project_link_click: {
        project_title: { PDFloom: 1 },
        link_type: { github: 1 },
      },
      project_filter: {
        tech: { React: 1 },
      },
    });
  });
});
