import { describe, it, expect } from "vitest";
import { computeVisitorHash } from "../src/visitor-hash";

describe("computeVisitorHash", () => {
  it("is deterministic for the same ip/UA/day", () => {
    const now = new Date("2026-08-08T10:00:00Z");
    const a = computeVisitorHash("1.2.3.4", "ua-string", now);
    const b = computeVisitorHash("1.2.3.4", "ua-string", now);
    expect(a).toBe(b);
  });

  it("rotates across day boundaries", () => {
    const day1 = computeVisitorHash("1.2.3.4", "ua-string", new Date("2026-08-08T23:59:00Z"));
    const day2 = computeVisitorHash("1.2.3.4", "ua-string", new Date("2026-08-09T00:01:00Z"));
    expect(day1).not.toBe(day2);
  });

  it("differs for different IPs on the same day", () => {
    const now = new Date("2026-08-08T10:00:00Z");
    const a = computeVisitorHash("1.2.3.4", "ua-string", now);
    const b = computeVisitorHash("5.6.7.8", "ua-string", now);
    expect(a).not.toBe(b);
  });

  it("never leaks the raw IP into the output", () => {
    const hash = computeVisitorHash("1.2.3.4", "ua-string", new Date("2026-08-08T10:00:00Z"));
    expect(hash).not.toContain("1.2.3.4");
  });
});
