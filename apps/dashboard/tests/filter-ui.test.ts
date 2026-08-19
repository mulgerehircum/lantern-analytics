import { describe, it, expect } from "vitest";
import {
  buildRowFilterHref,
  buildEventDetailFilterHref,
  isActiveRowFilter,
  isActiveEventDetailFilter,
  buildFilterChip,
  ROW_FILTER_LABELS,
} from "../src/lib/filter-ui";
import type { RowFilterDimension } from "../src/lib/filter-ui";
import type { DashboardFilters } from "../src/lib/filter";

function filters(overrides: Partial<DashboardFilters> = {}): DashboardFilters {
  return { ...overrides };
}

function paramsOf(href: string): URLSearchParams {
  return new URL(href, "http://x").searchParams;
}

describe("buildRowFilterHref", () => {
  const dims: RowFilterDimension[] = ["path", "referrer", "country", "device", "eventName"];

  it.each(dims)("builds an href with exactly siteId + %s, nothing else", (dim) => {
    const href = buildRowFilterHref("site1", dim, "value1");
    const params = paramsOf(href);
    expect(href.startsWith("/?")).toBe(true);
    expect([...params.keys()].sort()).toEqual(["siteId", dim].sort());
    expect(params.get("siteId")).toBe("site1");
    expect(params.get(dim)).toBe("value1");
  });

  it("never carries over other params — a fresh call always replaces, never composes", () => {
    // buildRowFilterHref takes no "previous filters" argument at all, so
    // there's no way for a caller to accidentally compose filters — this
    // test pins that as an intentional API shape, not an oversight.
    const href = buildRowFilterHref("site1", "country", "MD");
    expect(paramsOf(href).has("path")).toBe(false);
    expect(paramsOf(href).has("month")).toBe(false);
  });
});

describe("buildEventDetailFilterHref", () => {
  it("builds an href with exactly siteId, eventName, eventKey, eventValue", () => {
    const href = buildEventDetailFilterHref("site1", "contact_click", "platform", "email");
    const params = paramsOf(href);
    expect([...params.keys()].sort()).toEqual(["eventKey", "eventName", "eventValue", "siteId"]);
    expect(params.get("eventName")).toBe("contact_click");
    expect(params.get("eventKey")).toBe("platform");
    expect(params.get("eventValue")).toBe("email");
  });

  it("round-trips values containing special characters", () => {
    const href = buildEventDetailFilterHref("site1", "section_view", "section id", "about, us & more");
    const params = paramsOf(href);
    expect(params.get("eventKey")).toBe("section id");
    expect(params.get("eventValue")).toBe("about, us & more");
  });
});

describe("isActiveRowFilter", () => {
  it("is true when the dimension's value matches exactly", () => {
    expect(isActiveRowFilter(filters({ country: "MD" }), "country", "MD")).toBe(true);
  });

  it("is false when the dimension's value differs", () => {
    expect(isActiveRowFilter(filters({ country: "MD" }), "country", "US")).toBe(false);
  });

  it("is false when the dimension is unset", () => {
    expect(isActiveRowFilter(filters({}), "country", "MD")).toBe(false);
  });

  it("is false for a matching value under a different dimension (no cross-dimension false positive)", () => {
    expect(isActiveRowFilter(filters({ country: "MD" }), "referrer", "MD")).toBe(false);
  });
});

describe("isActiveEventDetailFilter", () => {
  const active = filters({ eventName: "contact_click", eventKey: "platform", eventValue: "email" });

  it("is true only when all three fields match", () => {
    expect(isActiveEventDetailFilter(active, "contact_click", "platform", "email")).toBe(true);
  });

  it("is false when eventName mismatches", () => {
    expect(isActiveEventDetailFilter(active, "project_link_click", "platform", "email")).toBe(false);
  });

  it("is false when eventKey mismatches", () => {
    expect(isActiveEventDetailFilter(active, "contact_click", "priority", "email")).toBe(false);
  });

  it("is false when eventValue mismatches", () => {
    expect(isActiveEventDetailFilter(active, "contact_click", "platform", "phone")).toBe(false);
  });

  it("is false when none of the three are set", () => {
    expect(isActiveEventDetailFilter(filters({}), "contact_click", "platform", "email")).toBe(false);
  });
});

describe("buildFilterChip", () => {
  it("returns undefined when no filter is active", () => {
    expect(buildFilterChip("site1", filters({}))).toBeUndefined();
  });

  it("prefers the eventKey+eventValue combo even when a single dimension is also set", () => {
    const chip = buildFilterChip(
      "site1",
      filters({ path: "/contact", eventName: "contact_click", eventKey: "platform", eventValue: "email" }),
    );
    expect(chip).toEqual({ label: "contact_click · platform", value: "email", clearHref: "/?siteId=site1" });
  });

  it("falls back to 'Event' as the label prefix when eventName is missing", () => {
    const chip = buildFilterChip("site1", filters({ eventKey: "platform", eventValue: "email" }));
    expect(chip?.label).toBe("Event · platform");
  });

  it("picks the earliest-priority dimension when multiple are simultaneously set", () => {
    expect(buildFilterChip("site1", filters({ country: "MD", device: "mobile" }))?.label).toBe(ROW_FILTER_LABELS.country);
    expect(buildFilterChip("site1", filters({ device: "mobile", eventName: "contact_click" }))?.label).toBe(
      ROW_FILTER_LABELS.device,
    );
    expect(buildFilterChip("site1", filters({ referrer: "google.com", country: "MD" }))?.label).toBe(
      ROW_FILTER_LABELS.referrer,
    );
  });

  it("clearHref is always /?siteId=<id>, regardless of which dimension is active", () => {
    expect(buildFilterChip("site1", filters({ path: "/x" }))?.clearHref).toBe("/?siteId=site1");
    expect(buildFilterChip("site1", filters({ eventName: "e", eventKey: "k", eventValue: "v" }))?.clearHref).toBe(
      "/?siteId=site1",
    );
  });
});
