import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimitForTests } from "../src/lib/rate-limit";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimitForTests();
  });

  it("allows requests up to the per-window cap", () => {
    const now = 1_000_000;
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      expect(checkRateLimit(now).allowed).toBe(true);
    }
  });

  it("rejects the request after the cap is reached within the same window", () => {
    const now = 1_000_000;
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      checkRateLimit(now);
    }
    const result = checkRateLimit(now);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("reports retryAfterSeconds bounded by the window length", () => {
    const now = 1_000_000;
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      checkRateLimit(now);
    }
    const result = checkRateLimit(now);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(WINDOW_MS / 1000);
  });

  it("resets the count once the window elapses", () => {
    const start = 1_000_000;
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      checkRateLimit(start);
    }
    expect(checkRateLimit(start).allowed).toBe(false);

    const afterWindow = start + WINDOW_MS;
    expect(checkRateLimit(afterWindow).allowed).toBe(true);
  });

  it("starts a fresh window exactly at the boundary, not one tick early", () => {
    const start = 1_000_000;
    checkRateLimit(start);
    // Just before the window elapses, still counts toward the same window.
    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW - 1; i++) {
      checkRateLimit(start + WINDOW_MS - 1);
    }
    expect(checkRateLimit(start + WINDOW_MS - 1).allowed).toBe(false);
  });
});
