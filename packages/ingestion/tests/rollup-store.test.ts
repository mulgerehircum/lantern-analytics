import { describe, it, expect } from "vitest";
import { hourPrefix } from "../src/rollup-store";

describe("hourPrefix", () => {
  it("formats as YYYY-MM-DDTHH", () => {
    expect(hourPrefix(new Date("2026-08-08T14:37:22Z"))).toBe("2026-08-08T14");
  });

  it("pads single-digit hours", () => {
    expect(hourPrefix(new Date("2026-08-08T05:00:00Z"))).toBe("2026-08-08T05");
  });
});
