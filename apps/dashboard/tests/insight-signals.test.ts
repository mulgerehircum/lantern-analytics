import { describe, it, expect } from "vitest";
import { buildInsightSignals, splitComparisonWindows } from "../src/lib/insight-signals";
import type { DashboardSummary } from "../src/lib/summarize";
import type { HourlyRollupItem } from "../src/lib/dynamodb";

function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    totalPageviews: 0,
    totalUniques: 0,
    topPages: [],
    referrers: [],
    countries: [],
    devices: [],
    timeSeries: [],
    customEvents: [],
    customEventBreakdown: [],
    ...overrides,
  };
}

function rollup(sk: string, pageviews = 1, uniques = 1): HourlyRollupItem {
  return { SK: sk, pageviews, uniques, topPages: {}, referrers: {}, countries: {}, devices: {} };
}

describe("buildInsightSignals", () => {
  const current = summary({
    totalPageviews: 488,
    totalUniques: 200,
    referrers: [
      { referrer: "github.com", count: 292 },
      { referrer: "direct", count: 132 },
      { referrer: "news.ycombinator.com", count: 40 },
      { referrer: "tiny-new-source", count: 3 },
    ],
    devices: [
      { device: "desktop", count: 485 },
      { device: "mobile", count: 3 },
    ],
    customEvents: [
      { name: "card_variant_view", count: 1080 },
      { name: "project_link_click", count: 40 },
      { name: "iframe_expand_click", count: 25 },
      { name: "contact_click", count: 6 },
      { name: "section_view", count: 1289 },
    ],
  });

  it("computes experiment CTR ratios from the semantics registry pairings", () => {
    const signals = buildInsightSignals(current, undefined, null);
    const ctr = signals.ratios.find((r) => r.label.startsWith("card_variant_view"));
    expect(ctr).toBeDefined();
    expect(ctr!.numerator).toBe(65); // project_link_click + iframe_expand_click
    expect(ctr!.denominator).toBe(1080);
    expect(ctr!.percent).toBeCloseTo(6, 0); // 65/1080 = 6.0%
  });

  it("computes contact rate against pageviews", () => {
    const signals = buildInsightSignals(current, undefined, null);
    const contact = signals.ratios.find((r) => r.label.startsWith("contact_click"));
    expect(contact!.percent).toBeCloseTo(1.2, 1); // 6/488
  });

  it("does not invent ratios for events without pairings", () => {
    const signals = buildInsightSignals(current, undefined, null);
    expect(signals.ratios.some((r) => r.label.startsWith("section_view"))).toBe(false);
  });

  it("emits no deltas when previous is undefined (filtered view)", () => {
    const signals = buildInsightSignals(current, undefined, null);
    expect(signals.comparisonBasis).toBeNull();
    expect(signals.referrerDeltas).toEqual([]);
    expect(signals.pageviewsDeltaPercent).toBeNull();
    expect(signals.ratios.length).toBeGreaterThan(0); // ratios still available
  });

  describe("with a previous period", () => {
    const previous = summary({
      totalPageviews: 400,
      totalUniques: 180,
      referrers: [
        { referrer: "github.com", count: 100 },
        { referrer: "direct", count: 132 },
        { referrer: "reddit.com", count: 60 },
      ],
      devices: [
        { device: "desktop", count: 380 },
        { device: "mobile", count: 20 },
      ],
      customEvents: [],
    });
    const signals = buildInsightSignals(current, previous, "period-over-period");

    it("computes top-level deltas", () => {
      expect(signals.pageviewsDeltaPercent).toBeCloseTo(22, 0); // (488-400)/400 = 22%
      expect(signals.comparisonBasis).toBe("period-over-period");
    });

    it("computes per-referrer deltas including growth on existing sources", () => {
      const github = signals.referrerDeltas.find((d) => d.key === "github.com");
      expect(github!.deltaPercent).toBeCloseTo(192, 0); // 292 vs 100
    });

    it("reports collapsed sources as -100 with current 0", () => {
      const reddit = signals.referrerDeltas.find((d) => d.key === "reddit.com");
      expect(reddit).toBeDefined();
      expect(reddit!.deltaPercent).toBe(-100);
      expect(reddit!.current).toBe(0);
    });

    it("treats a previously-zero source below the noise floor as not-new signal", () => {
      // tiny-new-source: 3 views, no previous presence -> below MIN_DELTA_COUNT
      expect(signals.referrerDeltas.find((d) => d.key === "tiny-new-source")).toBeUndefined();
    });

    it("computes device deltas (mobile collapse 20 -> 3)", () => {
      const mobile = signals.deviceDeltas.find((d) => d.key === "mobile");
      expect(mobile!.deltaPercent).toBeCloseTo(-85, 0);
    });

    it("keeps ratios computed from the current summary only", () => {
      expect(signals.ratios.find((r) => r.label.startsWith("card_variant_view"))).toBeDefined();
    });
  });
});

describe("splitComparisonWindows", () => {
  const now = new Date("2026-09-15T12:00:00.000Z");
  // Trailing window starts exactly now-30d (Aug 16 12:00Z); the mirrored
  // prior window is the 30 days before that (Jul 17 12:00Z .. Aug 16 12:00Z).
  const rollups = [
    rollup("AGG#2026-09-15#10"), // current window
    rollup("AGG#2026-08-16#12"), // current window's first hour
    rollup("AGG#2026-08-16#11"), // previous window's last hour
    rollup("AGG#2026-07-17#12"), // previous window's first hour (cutoff)
    rollup("AGG#2026-07-17#11"), // older than the mirrored prior window - ignored
    rollup("AGG#2026-09-16#00"), // "future" vs now - excluded from both
  ];

  it("splits rollups into trailing and mirrored prior windows of equal length", () => {
    const { current, previous, basis } = splitComparisonWindows(rollups, 30, now);
    expect(basis).toBe("trailing-30d");
    expect(current.map((r) => r.SK)).toEqual(["AGG#2026-09-15#10", "AGG#2026-08-16#12"]);
    expect(previous.map((r) => r.SK)).toEqual(["AGG#2026-08-16#11", "AGG#2026-07-17#12"]);
  });

  it("drops unparseable and future rollups", () => {
    const junk = [...rollups, rollup("garbage")];
    const { current, previous } = splitComparisonWindows(junk, 30, now);
    expect(current.length + previous.length).toBe(4); // junk + future not in either
  });

  it("falls back to history halves when there is no full prior window", () => {
    // 20 days of history ending now: not enough for trailing-30d + mirrored
    // prior, so split at the time midpoint (Sep-4 23:30Z) - everything after
    // into current, everything before into previous.
    const young = [
      rollup("AGG#2026-09-15#00"),
      rollup("AGG#2026-08-26#00"), // before the midpoint -> previous
      rollup("AGG#2026-08-25#23"), // before the midpoint -> previous
    ];
    const { current, previous, basis } = splitComparisonWindows(young, 30, now);
    expect(basis).toBe("history-halves");
    expect(current.map((r) => r.SK)).toEqual(["AGG#2026-09-15#00"]);
    expect(previous.map((r) => r.SK)).toEqual(["AGG#2026-08-26#00", "AGG#2026-08-25#23"]);
  });

  it("uses halves when a stray hour precedes the trailing window but no full prior window exists", () => {
    // Site alive ~31 days: one stray hour older than the trailing window
    // would nominally form a "prior window" of a single hour - a comparison
    // of one hour vs 30 days is noise, so the midpoint split is the
    // honest choice.
    const lopsided = [
      rollup("AGG#2026-09-15#00"),
      rollup("AGG#2026-08-20#00"),
      rollup("AGG#2026-08-15#00"), // 31.5d before now - just outside trailing
    ];
    const { basis } = splitComparisonWindows(lopsided, 30, now);
    expect(basis).toBe("history-halves");
  });

  it("uses halves when history reaches back 60d+ only through a dark gap in the prior window", () => {
    // Earliest rollup is 70d old (so a full mirrored window "exists" by
    // span) but there is zero data in the prior window itself - comparing
    // trailing-30d against nothing would produce all-null deltas again.
    const gappy = [
      rollup("AGG#2026-09-15#00"),
      rollup("AGG#2026-08-20#00"),
      rollup("AGG#2026-07-07#00"), // 70d old - before the prior window
    ];
    const { basis } = splitComparisonWindows(gappy, 30, now);
    expect(basis).toBe("history-halves");
  });

  it("returns null basis when history is too short to compare", () => {
    const short = [rollup("AGG#2026-09-15#00"), rollup("AGG#2026-09-14#00")];
    const { current, previous, basis } = splitComparisonWindows(short, 30, now);
    expect(basis).toBeNull();
    expect(current).toEqual([]);
    expect(previous).toEqual([]);
  });

  it("returns empty windows for empty input", () => {
    const { current, previous, basis } = splitComparisonWindows([], 30, now);
    expect(current).toEqual([]);
    expect(previous).toEqual([]);
    expect(basis).toBeNull();
  });
});
