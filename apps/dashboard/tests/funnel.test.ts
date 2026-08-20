import { describe, expect, it } from "vitest";
import { computeFunnel } from "../src/lib/funnel";
import type { RawEventRecordWithKey } from "../src/lib/dynamodb";

function event(overrides: Partial<RawEventRecordWithKey> & { SK: string; visitorHash: string }): RawEventRecordWithKey {
  return {
    path: "/",
    country: "US",
    device: "desktop",
    ...overrides,
  };
}

describe("computeFunnel", () => {
  it("returns [] for zero steps", () => {
    expect(computeFunnel([], [])).toEqual([]);
  });

  it("counts a single-step funnel as everyone who fired a matching event", () => {
    const events = [
      event({ SK: "EVENT#2026-08-08T10:00:00Z#a", visitorHash: "v1", path: "/" }),
      event({ SK: "EVENT#2026-08-08T10:00:00Z#b", visitorHash: "v2", path: "/" }),
      event({ SK: "EVENT#2026-08-08T10:00:00Z#c", visitorHash: "v3", path: "/other" }),
    ];
    const result = computeFunnel(events, [{ type: "path", value: "/" }]);
    expect(result).toHaveLength(1);
    expect(result[0].visitorCount).toBe(3); // "/other" still matches substring "/"
  });

  it("requires steps in order — an out-of-order event doesn't count", () => {
    const events = [
      // v1: contact_click on a different page, BEFORE landing on "/home" — should not complete the funnel
      event({ SK: "EVENT#2026-08-08T09:00:00Z#a", visitorHash: "v1", name: "contact_click", path: "/other" }),
      event({ SK: "EVENT#2026-08-08T10:00:00Z#b", visitorHash: "v1", path: "/home" }),
      // v2: correct order
      event({ SK: "EVENT#2026-08-08T09:00:00Z#c", visitorHash: "v2", path: "/home" }),
      event({ SK: "EVENT#2026-08-08T10:00:00Z#d", visitorHash: "v2", name: "contact_click", path: "/home" }),
    ];
    const result = computeFunnel(events, [
      { type: "path", value: "/home" },
      { type: "event", value: "contact_click" },
    ]);
    expect(result[0].visitorCount).toBe(2); // both landed on "/home"
    expect(result[1].visitorCount).toBe(1); // only v2 completed in order
  });

  it("drops a visitor who never reaches a later step", () => {
    const events = [
      event({ SK: "EVENT#2026-08-08T09:00:00Z#a", visitorHash: "v1", path: "/" }),
      event({ SK: "EVENT#2026-08-08T09:00:00Z#b", visitorHash: "v2", path: "/" }),
      event({ SK: "EVENT#2026-08-08T10:00:00Z#c", visitorHash: "v2", name: "contact_click" }),
    ];
    const result = computeFunnel(events, [
      { type: "path", value: "/" },
      { type: "event", value: "contact_click" },
    ]);
    expect(result[0].visitorCount).toBe(2);
    expect(result[1].visitorCount).toBe(1);
  });

  it("excludes events with no visitorHash", () => {
    const events = [event({ SK: "EVENT#2026-08-08T09:00:00Z#a", visitorHash: "", path: "/" })];
    const result = computeFunnel(events, [{ type: "path", value: "/" }]);
    expect(result[0].visitorCount).toBe(0);
  });

  it("computes conversionFromStartPercent and conversionFromPreviousPercent", () => {
    const events = [
      event({ SK: "EVENT#2026-08-08T09:00:00Z#a", visitorHash: "v1", path: "/" }),
      event({ SK: "EVENT#2026-08-08T09:00:00Z#b", visitorHash: "v2", path: "/" }),
      event({ SK: "EVENT#2026-08-08T09:00:00Z#c", visitorHash: "v3", path: "/" }),
      event({ SK: "EVENT#2026-08-08T09:00:00Z#d", visitorHash: "v4", path: "/" }),
      event({ SK: "EVENT#2026-08-08T10:00:00Z#e", visitorHash: "v1", name: "contact_click" }),
    ];
    const result = computeFunnel(events, [
      { type: "path", value: "/" },
      { type: "event", value: "contact_click" },
    ]);
    expect(result[0]).toMatchObject({ visitorCount: 4, conversionFromStartPercent: 100, conversionFromPreviousPercent: 100 });
    expect(result[1]).toMatchObject({ visitorCount: 1, conversionFromStartPercent: 25, conversionFromPreviousPercent: 25 });
  });

  it("returns 0% (not NaN/Infinity) when step 0 has zero visitors", () => {
    const result = computeFunnel([], [{ type: "event", value: "contact_click" }]);
    expect(result[0]).toMatchObject({ visitorCount: 0, conversionFromStartPercent: 0, conversionFromPreviousPercent: 100 });
  });

  it("matches event-type steps by exact eventName, path-type steps by substring", () => {
    const events = [
      event({ SK: "EVENT#2026-08-08T09:00:00Z#a", visitorHash: "v1", path: "/projects/pdfloom" }),
      event({ SK: "EVENT#2026-08-08T09:00:00Z#b", visitorHash: "v2", name: "project_link_click" }),
      event({ SK: "EVENT#2026-08-08T09:00:00Z#c", visitorHash: "v3", name: "iframe_expand_click" }),
    ];
    const pathResult = computeFunnel(events, [{ type: "path", value: "/projects" }]);
    expect(pathResult[0].visitorCount).toBe(1);

    const eventResult = computeFunnel(events, [{ type: "event", value: "project_link_click" }]);
    expect(eventResult[0].visitorCount).toBe(1);
  });
});
