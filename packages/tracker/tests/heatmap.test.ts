import { describe, it, expect } from "vitest";
import { computeClickPercent } from "../src/heatmap";

describe("computeClickPercent", () => {
  it("computes page-relative percentages", () => {
    expect(computeClickPercent({ pageX: 400, pageY: 900 }, { scrollWidth: 1000, scrollHeight: 2000 })).toEqual({
      xPct: 40,
      yPct: 45,
    });
  });

  it("clamps to [0, 100] for out-of-bounds coordinates", () => {
    expect(computeClickPercent({ pageX: -50, pageY: 5000 }, { scrollWidth: 1000, scrollHeight: 1000 })).toEqual({
      xPct: 0,
      yPct: 100,
    });
  });

  it("returns 0 rather than dividing by zero when scrollWidth/scrollHeight is 0", () => {
    expect(computeClickPercent({ pageX: 10, pageY: 10 }, { scrollWidth: 0, scrollHeight: 0 })).toEqual({ xPct: 0, yPct: 0 });
  });

  it("rounds to the nearest integer", () => {
    expect(computeClickPercent({ pageX: 333, pageY: 667 }, { scrollWidth: 1000, scrollHeight: 1000 })).toEqual({
      xPct: 33,
      yPct: 67,
    });
  });
});
