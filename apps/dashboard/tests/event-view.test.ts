import { describe, it, expect } from "vitest";
import { buildEventView, selectLatestEvents, isPassiveImpressionEvent } from "../src/lib/event-view";
import type { RawEventRecordWithKey } from "../src/lib/dynamodb";
import type { DashboardFilters } from "../src/lib/filter";

function event(overrides: Partial<RawEventRecordWithKey> = {}): RawEventRecordWithKey {
  return {
    SK: "EVENT#2026-09-06T14:32:10Z#abc123",
    path: "/",
    country: "US",
    device: "desktop",
    visitorHash: "v1",
    name: "cv_download",
    ...overrides,
  };
}

describe("buildEventView", () => {
  const events: RawEventRecordWithKey[] = [
    event({ SK: "EVENT#2026-09-05T10:00:00Z#a", visitorHash: "v1", country: "US", device: "desktop", path: "/" }),
    event({ SK: "EVENT#2026-09-05T12:00:00Z#b", visitorHash: "v2", country: "UA", device: "mobile", path: "/cv" }),
    event({ SK: "EVENT#2026-09-06T09:00:00Z#c", visitorHash: "v1", country: "US", device: "desktop", path: "/", metadata: { variant: "iframe" } }),
    // Different event name - must be excluded by the eventName filter.
    event({ SK: "EVENT#2026-09-06T11:00:00Z#d", name: "contact_click", visitorHash: "v9" }),
    // Pageview (no name) - excluded too.
    event({ SK: "EVENT#2026-09-06T12:00:00Z#e", name: undefined, visitorHash: "v1" }),
  ];

  it("counts occurrences and distinct visitors of the filtered event", () => {
    const view = buildEventView(events, { eventName: "cv_download" });
    expect(view.count).toBe(3);
    expect(view.uniqueVisitors).toBe(2); // v1 twice, v2 once
  });

  it("breaks down by country, device, path, and metadata from the same events", () => {
    const view = buildEventView(events, { eventName: "cv_download" });
    expect(view.countries).toEqual([
      { key: "US", count: 2 },
      { key: "UA", count: 1 },
    ]);
    expect(view.devices).toEqual([
      { key: "desktop", count: 2 },
      { key: "mobile", count: 1 },
    ]);
    expect(view.paths).toEqual([
      { key: "/", count: 2 },
      { key: "/cv", count: 1 },
    ]);
    expect(view.metadata).toEqual([{ key: "variant: iframe", count: 1 }]);
  });

  it("groups daily counts by the SK's embedded timestamp", () => {
    const view = buildEventView(events, { eventName: "cv_download" });
    expect(view.daily).toEqual([
      { day: "2026-09-05", count: 2 },
      { day: "2026-09-06", count: 1 },
    ]);
  });

  it("respects eventKey+eventValue detail filters", () => {
    const view = buildEventView(events, { eventName: "cv_download", eventKey: "variant", eventValue: "iframe" });
    expect(view.count).toBe(1);
    expect(view.uniqueVisitors).toBe(1);
    expect(view.countries).toEqual([{ key: "US", count: 1 }]);
  });

  it("returns empty structures for no matches", () => {
    const view = buildEventView(events, { eventName: "nonexistent" });
    expect(view.count).toBe(0);
    expect(view.uniqueVisitors).toBe(0);
    expect(view.daily).toEqual([]);
    expect(view.countries).toEqual([]);
  });

  it("skips non-string metadata values", () => {
    const withNumber = [
      event({ SK: "EVENT#2026-09-05T10:00:00Z#a", metadata: { attempts: 3, note: "hi" } }),
    ];
    const view = buildEventView(withNumber, { eventName: "cv_download" });
    expect(view.metadata).toEqual([{ key: "note: hi", count: 1 }]);
  });
});

describe("isPassiveImpressionEvent", () => {
  it("identifies A/B experiment impressions", () => {
    expect(isPassiveImpressionEvent("card_variant_view")).toBe(true);
  });

  it("identifies passive scroll-past impressions (section_view)", () => {
    expect(isPassiveImpressionEvent("section_view")).toBe(true);
  });

  it("keeps real actions and unknown names out", () => {
    expect(isPassiveImpressionEvent("cv_download")).toBe(false);
    expect(isPassiveImpressionEvent("contact_click")).toBe(false);
    expect(isPassiveImpressionEvent("project_filter")).toBe(false); // real interaction even though not a click
    expect(isPassiveImpressionEvent("expertise_icon_hover")).toBe(false);
    expect(isPassiveImpressionEvent("mystery_new_event")).toBe(false);
  });
});

describe("selectLatestEvents", () => {
  const events: RawEventRecordWithKey[] = [
    event({ SK: "EVENT#2026-09-05T10:00:00Z#a", name: "cv_download", visitorHash: "v1" }),
    event({ SK: "EVENT#2026-09-06T12:00:00Z#b", name: "contact_click", visitorHash: "v2" }),
    event({ SK: "EVENT#2026-09-06T15:00:00Z#c", name: "card_variant_view", visitorHash: "v3" }), // A/B impression
    event({ SK: "EVENT#2026-09-06T14:00:00Z#z", name: "section_view", visitorHash: "v3" }), // scroll-past impression
    event({ SK: "EVENT#2026-09-06T16:00:00Z#d", name: "lantern_heatmap_click", visitorHash: "v4" }), // heatmap ping
    event({ SK: "EVENT#2026-09-06T11:00:00Z#e", name: undefined, visitorHash: "v5" }), // pageview
    event({ SK: "EVENT#2026-09-04T09:00:00Z#f", name: "project_link_click", visitorHash: "v6" }),
  ];

  it("returns meaningful custom events newest first", () => {
    const { rows, total } = selectLatestEvents(events, 10);
    expect(total).toBe(3); // cv_download, contact_click, project_link_click
    expect(rows.map((r) => r.name)).toEqual(["contact_click", "cv_download", "project_link_click"]);
  });

  it("excludes passive impressions, heatmap pings, and pageviews", () => {
    const { rows } = selectLatestEvents(events, 10);
    const names = rows.map((r) => r.name);
    expect(names).not.toContain("card_variant_view");
    expect(names).not.toContain("section_view");
    expect(names).not.toContain("lantern_heatmap_click");
    expect(rows.every((r) => typeof r.name === "string")).toBe(true);
  });

  it("caps the rows at the limit", () => {
    const { rows, total } = selectLatestEvents(events, 1);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("contact_click"); // newest
    expect(total).toBe(3); // total is uncapped
  });

  it("drops events with unparseable SKs", () => {
    const junk = [event({ SK: "garbage", name: "cv_download" }), event({ SK: "EVENT#2026-09-06T12:00:00Z#b", name: "contact_click" })];
    const { rows, total } = selectLatestEvents(junk, 10);
    expect(total).toBe(1);
    expect(rows[0].name).toBe("contact_click");
  });

  it("returns empty for input with no eligible events", () => {
    const { rows, total } = selectLatestEvents([event({ name: "card_variant_view" })], 10);
    expect(rows).toEqual([]);
    expect(total).toBe(0);
  });

  it("diversifies: one visitor's burst no longer fills the feed", () => {
    // A chatty visitor interacting repeatedly (project_filter is a real
    // action - the burst shape matters, not the event kind; impressions
    // are excluded entirely by the passive filter).
    const burst: RawEventRecordWithKey[] = Array.from({ length: 12 }, (_, i) =>
      event({
        SK: `EVENT#2026-09-06T1${Math.floor(i / 6)}:0${i % 6}:00Z#s${i}`,
        name: "project_filter",
        visitorHash: "chatty",
      }),
    );
    const other: RawEventRecordWithKey[] = [
      event({ SK: "EVENT#2026-09-06T09:00:00Z#x1", name: "cv_download", visitorHash: "quiet1" }),
      event({ SK: "EVENT#2026-09-06T08:00:00Z#x2", name: "contact_click", visitorHash: "quiet2" }),
    ];
    const { rows } = selectLatestEvents([...burst, ...other], 10);
    const byVisitor = new Map<string, number>();
    for (const r of rows) byVisitor.set(r.visitorHash, (byVisitor.get(r.visitorHash) ?? 0) + 1);
    // Round-robin with a ceil(10/3)=4 per-visitor cap: chatty can never
    // exceed 4 of the 10 rows even after quiet1/quiet2 exhaust.
    expect(byVisitor.get("chatty")!).toBe(4);
    expect(byVisitor.get("quiet1")).toBe(1);
    expect(byVisitor.get("quiet2")).toBe(1);
    expect(rows[0].name).toBe("project_filter"); // newest overall still first
    // Quiet visitors' events appear in the first pass, interleaved, not
    // buried under chatty's burst.
    const quietPositions = rows.findIndex((r) => r.visitorHash === "quiet1");
    expect(quietPositions).toBe(1); // right after chatty's newest
  });

  it("gives every distinct visitor a turn before repeating anyone", () => {
    // Two visitors with bursts: the feed must interleave them, not show
    // one then the other.
    const a = Array.from({ length: 6 }, (_, i) =>
      event({ SK: `EVENT#2026-09-06T10:0${i}:00Z#a${i}`, name: "expertise_icon_hover", visitorHash: "A" }),
    );
    const b = Array.from({ length: 6 }, (_, i) =>
      event({ SK: `EVENT#2026-09-06T09:0${i}:00Z#b${i}`, name: "expertise_icon_hover", visitorHash: "B" }),
    );
    const { rows } = selectLatestEvents([...a, ...b], 6);
    expect(rows.map((r) => r.visitorHash)).toEqual(["A", "B", "A", "B", "A", "B"]);
  });

  it("shows a single visitor's full activity when they are the only visitor", () => {
    const solo: RawEventRecordWithKey[] = Array.from({ length: 5 }, (_, i) =>
      event({ SK: `EVENT#2026-09-06T0${i}:30:00Z#s${i}`, name: "iframe_expand_click", visitorHash: "solo" }),
    );
    const { rows } = selectLatestEvents(solo, 10);
    expect(rows).toHaveLength(5);
    expect(rows[0].timestampMs).toBeGreaterThan(rows[4].timestampMs);
  });
});
