import { describe, it, expect } from "vitest";
import { EVENT_SEMANTICS, renderEventSemantics, getEventSemantics } from "../src/lib/event-semantics";

describe("EVENT_SEMANTICS registry", () => {
  it("marks card_variant_view as an experiment impression that pairs with its clicks", () => {
    const s = EVENT_SEMANTICS["card_variant_view"];
    expect(s.kind).toBe("experiment-impression");
    expect(s.pairsWith).toContain("project_link_click");
    expect(s.pairsWith).toContain("iframe_expand_click");
  });

  it("marks passive section impressions as impressions", () => {
    expect(EVENT_SEMANTICS["section_view"].kind).toBe("impression");
    expect(EVENT_SEMANTICS["section_view"].pairsWith).toBeUndefined();
  });

  it("marks real click/download actions as clicks/downloads", () => {
    expect(EVENT_SEMANTICS["contact_click"].kind).toBe("click");
    expect(EVENT_SEMANTICS["cv_download"].kind).toBe("download");
  });

  it("looks up unknown names as undefined (never invents semantics)", () => {
    expect(getEventSemantics("definitely_not_registered")).toBeUndefined();
  });
});

describe("renderEventSemantics", () => {
  it("renders only known events present in the data", () => {
    const rendered = renderEventSemantics(["card_variant_view", "contact_click", "unknown_event"]);
    expect(rendered).toContain("card_variant_view");
    expect(rendered).toContain("contact_click");
    expect(rendered).not.toContain("unknown_event");
  });

  it("states the pairing rule on impression events that have pairings", () => {
    const rendered = renderEventSemantics(["card_variant_view"]);
    expect(rendered).toContain("project_link_click");
    expect(rendered).toContain("click-through rate");
  });

  it("returns null when no known events appear", () => {
    expect(renderEventSemantics(["only_unknown"])).toBeNull();
    expect(renderEventSemantics([])).toBeNull();
  });

  it("emits each known event exactly once regardless of input duplicates", () => {
    const rendered = renderEventSemantics(["contact_click", "contact_click", "contact_click"]);
    expect((rendered!.match(/- contact_click/g) ?? []).length).toBe(1);
  });
});
