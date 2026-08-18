import { describe, it, expect } from "vitest";
import { summarizeExperiment, attachVariantToSessions } from "../src/lib/experiment";
import type { RawEventRecordWithKey } from "../src/lib/dynamodb";
import type { SessionRecordingItem } from "../src/lib/sessions";

function event(overrides: Partial<RawEventRecordWithKey> = {}): RawEventRecordWithKey {
  return {
    SK: "EVENT#2026-08-18T11:30:00Z#abc123",
    path: "/",
    country: "MD",
    device: "desktop",
    visitorHash: "hash-1",
    ...overrides,
  };
}

function session(overrides: Partial<SessionRecordingItem> = {}): SessionRecordingItem {
  return {
    sessionId: "s1",
    startedAt: "2026-08-18T11:30:00.000Z",
    durationMs: 60_000,
    pageCount: 1,
    storageRef: "ref1",
    ...overrides,
  };
}

describe("summarizeExperiment", () => {
  it("returns empty overall/byProject for no events", () => {
    const result = summarizeExperiment([]);
    expect(result.overall).toEqual([]);
    expect(result.byProject).toEqual([]);
  });

  it("ignores events without a variant metadata field", () => {
    const result = summarizeExperiment([
      event({ name: "card_variant_view", metadata: { project_title: "PDFloom" } }),
      event({ name: "contact_click", metadata: { platform: "email" } }),
    ]);
    expect(result.overall).toEqual([]);
  });

  it("counts impressions and live/github clicks per variant", () => {
    const result = summarizeExperiment([
      event({ name: "card_variant_view", metadata: { project_title: "PDFloom", variant: "iframe" } }),
      event({ name: "card_variant_view", metadata: { project_title: "PDFloom", variant: "iframe" } }),
      event({ name: "card_variant_view", metadata: { project_title: "PDFloom", variant: "video" } }),
      event({ name: "project_link_click", metadata: { project_title: "PDFloom", link_type: "live", variant: "iframe" } }),
      event({ name: "project_link_click", metadata: { project_title: "PDFloom", link_type: "github", variant: "iframe" } }),
    ]);
    expect(result.overall).toEqual([
      { variant: "iframe", impressions: 2, liveClicks: 1, githubClicks: 1, ctrPercent: 50 },
      { variant: "video", impressions: 1, liveClicks: 0, githubClicks: 0, ctrPercent: 0 },
    ]);
  });

  it("breaks down stats per project", () => {
    const result = summarizeExperiment([
      event({ name: "card_variant_view", metadata: { project_title: "PDFloom", variant: "iframe" } }),
      event({ name: "card_variant_view", metadata: { project_title: "Dataroom", variant: "video" } }),
      event({ name: "project_link_click", metadata: { project_title: "PDFloom", link_type: "live", variant: "iframe" } }),
    ]);
    expect(result.byProject).toEqual([
      {
        project: "Dataroom",
        variants: [{ variant: "video", impressions: 1, liveClicks: 0, githubClicks: 0, ctrPercent: 0 }],
      },
      {
        project: "PDFloom",
        variants: [{ variant: "iframe", impressions: 1, liveClicks: 1, githubClicks: 0, ctrPercent: 100 }],
      },
    ]);
  });

  it("sorts variants by impressions descending, then alphabetically", () => {
    const result = summarizeExperiment([
      event({ name: "card_variant_view", metadata: { project_title: "PDFloom", variant: "video" } }),
      event({ name: "card_variant_view", metadata: { project_title: "PDFloom", variant: "video" } }),
      event({ name: "card_variant_view", metadata: { project_title: "PDFloom", variant: "iframe" } }),
    ]);
    expect(result.overall.map((v) => v.variant)).toEqual(["video", "iframe"]);
  });
});

describe("attachVariantToSessions", () => {
  it("leaves sessions without a visitorHash untouched", () => {
    const result = attachVariantToSessions([session({ visitorHash: undefined })], []);
    expect(result[0].variant).toBeUndefined();
  });

  it("attaches the variant from a matching impression within the session window", () => {
    const result = attachVariantToSessions(
      [session({ visitorHash: "hash-1", startedAt: "2026-08-18T11:30:00.000Z", durationMs: 60_000 })],
      [
        event({
          SK: "EVENT#2026-08-18T11:30:10Z#abc",
          visitorHash: "hash-1",
          name: "card_variant_view",
          metadata: { project_title: "PDFloom", variant: "iframe" },
        }),
      ],
    );
    expect(result[0].variant).toBe("iframe");
  });

  it("does not attach a variant from a different visitor", () => {
    const result = attachVariantToSessions(
      [session({ visitorHash: "hash-1" })],
      [
        event({
          visitorHash: "hash-2",
          name: "card_variant_view",
          metadata: { project_title: "PDFloom", variant: "iframe" },
        }),
      ],
    );
    expect(result[0].variant).toBeUndefined();
  });

  it("does not attach a variant from outside the tolerance window", () => {
    const result = attachVariantToSessions(
      [session({ visitorHash: "hash-1", startedAt: "2026-08-18T11:30:00.000Z", durationMs: 60_000 })],
      [
        event({
          SK: "EVENT#2026-08-18T11:00:00Z#abc",
          visitorHash: "hash-1",
          name: "card_variant_view",
          metadata: { project_title: "PDFloom", variant: "iframe" },
        }),
      ],
    );
    expect(result[0].variant).toBeUndefined();
  });

  it("ignores non-impression events for matching", () => {
    const result = attachVariantToSessions(
      [session({ visitorHash: "hash-1", startedAt: "2026-08-18T11:30:00.000Z", durationMs: 60_000 })],
      [
        event({
          SK: "EVENT#2026-08-18T11:30:10Z#abc",
          visitorHash: "hash-1",
          name: "project_link_click",
          metadata: { project_title: "PDFloom", link_type: "live", variant: "iframe" },
        }),
      ],
    );
    expect(result[0].variant).toBeUndefined();
  });
});
