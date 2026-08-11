import { describe, it, expect } from "vitest";
import { aggregateEvents, type RawEventItem } from "../src/aggregate";

function event(overrides: Partial<RawEventItem> = {}): RawEventItem {
  return {
    path: "/",
    referrer: "",
    country: "unknown",
    device: "desktop",
    visitorHash: "hash-a",
    isNewVisit: false,
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
      customEvents: {},
      eventDimensions: {},
    });
  });

  it("counts total pageviews as the event count, including repeats from the same visitor", () => {
    const result = aggregateEvents([event(), event(), event()]);
    expect(result.pageviews).toBe(3);
  });

  it("counts uniques by isNewVisit, not by distinct visitorHash or event count", () => {
    // Same visitorHash on all three (as a real repeat-reload visitor would
    // have within one day) — uniques should reflect isNewVisit, not the hash.
    const result = aggregateEvents([
      event({ visitorHash: "a", isNewVisit: true }),
      event({ visitorHash: "a", isNewVisit: false }), // e.g. internal nav or reload
      event({ visitorHash: "b", isNewVisit: true }),
    ]);
    expect(result.pageviews).toBe(3);
    expect(result.uniques).toBe(2);
  });

  it("never counts a reload/internal-nav pageview as unique, even with a fresh visitorHash", () => {
    const result = aggregateEvents([event({ visitorHash: "c", isNewVisit: false })]);
    expect(result.pageviews).toBe(1);
    expect(result.uniques).toBe(0);
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

  it("counts custom events by name, keeping them out of pageview/uniques totals", () => {
    const result = aggregateEvents([
      event({ name: "contact_click", metadata: { platform: "email" }, referrer: undefined }),
      event({ name: "contact_click", metadata: { platform: "email" }, referrer: undefined }),
      event({ name: "cv_download", metadata: { filename: "CV.pdf" }, referrer: undefined }),
      event({ isNewVisit: true }),
    ]);
    expect(result.pageviews).toBe(1);
    expect(result.uniques).toBe(1);
    expect(result.customEvents).toEqual({ contact_click: 2, cv_download: 1 });
    expect(result.topPages).toEqual({ "/": 1 });
  });

  it("rolls up string metadata values into per-name dimension counts", () => {
    const result = aggregateEvents([
      event({ name: "project_link_click", metadata: { project_title: "PDFloom", link_type: "github" }, referrer: undefined }),
      event({ name: "project_link_click", metadata: { project_title: "PDFloom", link_type: "live" }, referrer: undefined }),
      event({ name: "project_filter", metadata: { tech: "React" }, referrer: undefined }),
      event({ name: "project_filter", metadata: { tech: "React" }, referrer: undefined }),
    ]);
    expect(result.eventDimensions).toEqual({
      project_link_click: {
        project_title: { PDFloom: 2 },
        link_type: { github: 1, live: 1 },
      },
      project_filter: {
        tech: { React: 2 },
      },
    });
  });

  it("ignores non-string metadata values in dimension rollups", () => {
    const result = aggregateEvents([
      event({ name: "click", metadata: { tag: "button", x: 12, active: true }, referrer: undefined }),
    ]);
    expect(result.eventDimensions).toEqual({ click: { tag: { button: 1 } } });
    expect(result.customEvents).toEqual({ click: 1 });
  });
});
