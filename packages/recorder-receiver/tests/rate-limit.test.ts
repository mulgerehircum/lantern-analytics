import { describe, expect, it } from "vitest";
import { RateLimiter } from "../src/rate-limit";

describe("RateLimiter", () => {
  it("allows up to capacity requests immediately, then blocks", () => {
    const limiter = new RateLimiter(3, 1);
    const now = 1_000_000;

    expect(limiter.tryConsume("ip-a", now)).toBe(true);
    expect(limiter.tryConsume("ip-a", now)).toBe(true);
    expect(limiter.tryConsume("ip-a", now)).toBe(true);
    expect(limiter.tryConsume("ip-a", now)).toBe(false);
  });

  it("refills over time", () => {
    const limiter = new RateLimiter(1, 1); // 1 token/sec refill
    const now = 1_000_000;

    expect(limiter.tryConsume("ip-a", now)).toBe(true);
    expect(limiter.tryConsume("ip-a", now)).toBe(false);
    // 2 seconds later, capacity(1) worth of tokens have refilled.
    expect(limiter.tryConsume("ip-a", now + 2000)).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const limiter = new RateLimiter(1, 1);
    const now = 1_000_000;

    expect(limiter.tryConsume("ip-a", now)).toBe(true);
    expect(limiter.tryConsume("ip-a", now)).toBe(false);
    expect(limiter.tryConsume("ip-b", now)).toBe(true);
  });
});
