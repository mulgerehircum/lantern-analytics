import { describe, it, expect } from "vitest";
import { parseFilters, hasActiveFilter, matchesFilter, buildFilteredRollups } from "../src/lib/filter";
import type { FilterableEvent } from "../src/lib/filter";

function event(overrides: Partial<FilterableEvent> = {}): FilterableEvent {
  return {
    SK: "EVENT#2026-08-08T11:30:00Z#abc123",
    path: "/",
    referrer: "google.com",
    country: "MD",
    device: "desktop",
    visitorHash: "hash-1",
    ...overrides,
  };
}

describe("parseFilters", () => {
  it("parses values out of searchParams and trims whitespace", () => {
    expect(parseFilters({ path: " /proj ", referrer: "google.com", country: "MD", device: "mobile" })).toEqual({
      path: "/proj",
      referrer: "google.com",
      country: "MD",
      device: "mobile",
    });
  });

  it("parses custom-event filters", () => {
    expect(
      parseFilters({ eventName: " contact_click ", eventKey: "platform", eventValue: " email " }),
    ).toEqual({ eventName: "contact_click", eventKey: "platform", eventValue: "email" });
  });

  it("uses the first value when a param repeats", () => {
    expect(parseFilters({ country: ["MD", "US"] })).toEqual({ country: "MD" });
  });

  it("turns empty/whitespace/missing params into undefined", () => {
    expect(parseFilters({ path: "", referrer: "   ", country: undefined })).toEqual({});
  });
});

describe("hasActiveFilter", () => {
  it("is false when no filter is set", () => {
    expect(hasActiveFilter({})).toBe(false);
  });

  it("is true when any filter is set", () => {
    expect(hasActiveFilter({ path: "/" })).toBe(true);
    expect(hasActiveFilter({ country: "MD" })).toBe(true);
  });

  it("is true when only a custom-event filter is set", () => {
    expect(hasActiveFilter({ eventName: "contact_click" })).toBe(true);
    expect(hasActiveFilter({ eventKey: "platform" })).toBe(true);
  });
});

describe("matchesFilter", () => {
  it("matches path as a substring", () => {
    expect(matchesFilter(event({ path: "/projects/loom" }), { path: "/projects" })).toBe(true);
    expect(matchesFilter(event({ path: "/about" }), { path: "/projects" })).toBe(false);
  });

  it("matches referrer/country/device exactly", () => {
    const e = event();
    expect(matchesFilter(e, { referrer: "google.com" })).toBe(true);
    expect(matchesFilter(e, { referrer: "direct" })).toBe(false);
    expect(matchesFilter(e, { country: "MD" })).toBe(true);
    expect(matchesFilter(e, { country: "md" })).toBe(false);
    expect(matchesFilter(e, { device: "desktop" })).toBe(true);
    expect(matchesFilter(e, { device: "mobile" })).toBe(false);
  });

  it("combines filters with AND semantics", () => {
    expect(matchesFilter(event({ path: "/pricing", country: "MD", device: "desktop" }), {
      path: "/pricing",
      country: "MD",
      device: "desktop",
    })).toBe(true);
    expect(matchesFilter(event({ path: "/pricing", country: "MD", device: "desktop" }), {
      path: "/pricing",
      country: "US",
    })).toBe(false);
  });

  it("matches custom events (no referrer) against path/country/device but not a referrer filter", () => {
    const custom = event({ path: "/contact", referrer: undefined, name: "contact_click", metadata: { platform: "email" } });
    expect(matchesFilter(custom, { path: "/contact" })).toBe(true);
    expect(matchesFilter(custom, { country: "MD" })).toBe(true);
    expect(matchesFilter(custom, { referrer: "google.com" })).toBe(false);
  });

  it("matches event name exactly and never matches a pageview (no name)", () => {
    const custom = event({ name: "contact_click", metadata: { platform: "email" } });
    expect(matchesFilter(custom, { eventName: "contact_click" })).toBe(true);
    expect(matchesFilter(custom, { eventName: "project_link_click" })).toBe(false);
    expect(matchesFilter(event({ name: undefined }), { eventName: "contact_click" })).toBe(false);
  });

  it("matches metadata key/value exactly when both are set", () => {
    const custom = event({ name: "contact_click", metadata: { platform: "email", priority: "high" } });
    expect(matchesFilter(custom, { eventKey: "platform", eventValue: "email" })).toBe(true);
    expect(matchesFilter(custom, { eventKey: "platform", eventValue: "phone" })).toBe(false);
    expect(matchesFilter(custom, { eventKey: "priority", eventValue: "email" })).toBe(false);
  });

  it("ignores a bare eventKey with no eventValue", () => {
    const custom = event({ name: "contact_click", metadata: { platform: "email" } });
    expect(matchesFilter(custom, { eventKey: "platform" })).toBe(true);
    expect(matchesFilter(event({ metadata: undefined }), { eventKey: "platform" })).toBe(true);
  });

  it("does not match a key/value filter against an event without metadata", () => {
    expect(matchesFilter(event({ metadata: undefined }), { eventKey: "platform", eventValue: "email" })).toBe(false);
  });

  it("combines custom-event filters with other filters via AND", () => {
    const custom = event({ path: "/contact", country: "MD", name: "contact_click", metadata: { platform: "email" } });
    expect(matchesFilter(custom, { eventName: "contact_click", country: "MD", eventKey: "platform", eventValue: "email" })).toBe(
      true,
    );
    expect(matchesFilter(custom, { eventName: "contact_click", country: "US" })).toBe(false);
  });
});

describe("buildFilteredRollups", () => {
  it("filters non-matching events out before aggregation", () => {
    const events = [
      event({ SK: "EVENT#2026-08-08T11:00:00Z#a", path: "/", country: "MD" }),
      event({ SK: "EVENT#2026-08-08T11:10:00Z#b", path: "/pricing", country: "US" }),
      event({ SK: "EVENT#2026-08-08T12:00:00Z#c", path: "/", country: "MD" }),
    ];
    const rollups = buildFilteredRollups(events, { country: "MD" });
    expect(rollups).toHaveLength(2);
    expect(rollups.reduce((sum, r) => sum + r.pageviews, 0)).toBe(2);
    expect(rollups.map((r) => r.SK)).toEqual(["AGG#2026-08-08#11", "AGG#2026-08-08#12"]);
  });

  it("groups events by hour and sums per-hour uniques from the filtered set", () => {
    const events = [
      event({ SK: "EVENT#2026-08-08T11:00:00Z#a", path: "/", visitorHash: "v1" }),
      event({ SK: "EVENT#2026-08-08T11:30:00Z#b", path: "/", visitorHash: "v1" }),
      event({ SK: "EVENT#2026-08-08T11:59:00Z#c", path: "/", visitorHash: "v2" }),
      event({ SK: "EVENT#2026-08-08T12:05:00Z#d", path: "/", visitorHash: "v3" }),
    ];
    const rollups = buildFilteredRollups(events, {});
    expect(rollups).toEqual([
      expect.objectContaining({ SK: "AGG#2026-08-08#11", pageviews: 3, uniques: 2 }),
      expect.objectContaining({ SK: "AGG#2026-08-08#12", pageviews: 1, uniques: 1 }),
    ]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(buildFilteredRollups([event({ country: "MD" })], { country: "US" })).toEqual([]);
  });

  it("rolls up only matching custom events when filtering by event name (pageviews excluded)", () => {
    const events = [
      event({ SK: "EVENT#2026-08-08T11:00:00Z#a", path: "/", name: undefined }),
      event({
        SK: "EVENT#2026-08-08T11:10:00Z#b",
        path: "/contact",
        name: "contact_click",
        metadata: { platform: "email" },
      }),
      event({
        SK: "EVENT#2026-08-08T11:20:00Z#c",
        path: "/projects/loom",
        name: "project_link_click",
        metadata: { project_title: "PDFloom" },
      }),
    ];
    const rollups = buildFilteredRollups(events, { eventName: "contact_click" });
    expect(rollups).toHaveLength(1);
    expect(rollups[0].pageviews).toBe(0);
    expect(rollups[0].customEvents).toEqual({ contact_click: 1 });
    expect(rollups[0].eventDimensions).toEqual({ contact_click: { platform: { email: 1 } } });
  });

  it("rolls up only matching events when filtering by metadata key/value", () => {
    const events = [
      event({
        SK: "EVENT#2026-08-08T11:00:00Z#a",
        path: "/contact",
        name: "contact_click",
        metadata: { platform: "email" },
      }),
      event({
        SK: "EVENT#2026-08-08T11:10:00Z#b",
        path: "/contact",
        name: "contact_click",
        metadata: { platform: "phone" },
      }),
    ];
    const rollups = buildFilteredRollups(events, { eventKey: "platform", eventValue: "phone" });
    expect(rollups).toHaveLength(1);
    expect(rollups[0].customEvents).toEqual({ contact_click: 1 });
  });
});
