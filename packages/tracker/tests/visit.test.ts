import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isNewVisit } from "../src/visit";

const originalDocument = globalThis.document;
const originalLocation = globalThis.location;
const originalPerformance = globalThis.performance;

function stub(options: { referrer?: string; hostname?: string; navType?: string | undefined }): void {
  // @ts-expect-error -- minimal stub is fine for this unit test
  globalThis.document = { referrer: options.referrer ?? "" };
  // @ts-expect-error -- minimal stub
  globalThis.location = { hostname: options.hostname ?? "example.test" };
  // @ts-expect-error -- minimal stub
  globalThis.performance = {
    getEntriesByType: (type: string) => (type === "navigation" ? [{ type: options.navType }].filter((e) => e.type !== undefined) : []),
  };
}

afterEach(() => {
  globalThis.document = originalDocument;
  globalThis.location = originalLocation;
  globalThis.performance = originalPerformance;
});

describe("isNewVisit", () => {
  it("is true for a fresh navigation with no referrer (direct)", () => {
    stub({ referrer: "", hostname: "example.test", navType: "navigate" });
    expect(isNewVisit()).toBe(true);
  });

  it("is true for a fresh navigation with an external referrer", () => {
    stub({ referrer: "https://google.com/search", hostname: "example.test", navType: "navigate" });
    expect(isNewVisit()).toBe(true);
  });

  it("is false for a fresh navigation with a same-site referrer (internal nav)", () => {
    stub({ referrer: "https://example.test/other-page", hostname: "example.test", navType: "navigate" });
    expect(isNewVisit()).toBe(false);
  });

  it("is false for a reload, even with no referrer", () => {
    stub({ referrer: "", hostname: "example.test", navType: "reload" });
    expect(isNewVisit()).toBe(false);
  });

  it("is false for a back/forward-cache restore, even with an external referrer", () => {
    stub({ referrer: "https://google.com", hostname: "example.test", navType: "back_forward" });
    expect(isNewVisit()).toBe(false);
  });

  it("falls back to the referrer-only check when Navigation Timing is unavailable", () => {
    stub({ referrer: "", hostname: "example.test", navType: undefined });
    expect(isNewVisit()).toBe(true);
  });
});
