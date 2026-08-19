import { describe, it, expect } from "vitest";
import { formatCustomEventLabel, mergeInteractionTimeline } from "../src/lib/interaction-timeline";

describe("formatCustomEventLabel", () => {
  it("returns the bare name when there's no metadata", () => {
    expect(formatCustomEventLabel("contact_click")).toBe("contact_click");
  });

  it("appends up to the first two metadata values", () => {
    expect(formatCustomEventLabel("project_link_click", { project_title: "PDFloom", link_type: "github" })).toBe(
      "project_link_click (PDFloom, github)",
    );
  });

  it("caps at two values even when more are present", () => {
    expect(formatCustomEventLabel("e", { a: "1", b: "2", c: "3" })).toBe("e (1, 2)");
  });

  it("returns the bare name for an empty metadata object", () => {
    expect(formatCustomEventLabel("e", {})).toBe("e");
  });
});

describe("mergeInteractionTimeline", () => {
  it("returns [] for empty inputs", () => {
    expect(mergeInteractionTimeline([], [])).toEqual([]);
  });

  it("passes rrweb clicks through unchanged when there are no custom events", () => {
    const result = mergeInteractionTimeline([], [{ offsetMs: 500, label: "a: click" }]);
    expect(result).toEqual([{ offsetMs: 500, label: "a: click", source: "rrweb-click" }]);
  });

  it("drops a rrweb click within the window of a custom event, keeping the custom event's label", () => {
    const result = mergeInteractionTimeline(
      [{ offsetMs: 1000, name: "contact_click" }],
      [{ offsetMs: 1400, label: "button: Contact" }],
      1000,
    );
    expect(result).toEqual([{ offsetMs: 1000, label: "contact_click", source: "custom-event" }]);
  });

  it("keeps both when farther apart than the window", () => {
    const result = mergeInteractionTimeline(
      [{ offsetMs: 1000, name: "contact_click" }],
      [{ offsetMs: 5000, label: "a: unrelated" }],
      1000,
    );
    expect(result).toEqual([
      { offsetMs: 1000, label: "contact_click", source: "custom-event" },
      { offsetMs: 5000, label: "a: unrelated", source: "rrweb-click" },
    ]);
  });

  it("keeps a click exactly at the window boundary as a duplicate (inclusive)", () => {
    const result = mergeInteractionTimeline([{ offsetMs: 1000, name: "e" }], [{ offsetMs: 2000, label: "x" }], 1000);
    expect(result).toEqual([{ offsetMs: 1000, label: "e", source: "custom-event" }]);
  });

  it("sorts the merged result ascending by offsetMs", () => {
    const result = mergeInteractionTimeline(
      [{ offsetMs: 5000, name: "later" }],
      [{ offsetMs: 100, label: "earlier" }],
    );
    expect(result.map((r) => r.offsetMs)).toEqual([100, 5000]);
  });
});
