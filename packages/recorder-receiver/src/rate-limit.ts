/**
 * Simple in-memory per-key token bucket. This, not the write token (which is
 * public — see README.md's "Auth" section), is the real defense against a
 * targeted abuser hammering the write endpoint to fill this machine's disk.
 *
 * Buckets are never pruned. At the portfolio-scale traffic this service is
 * built for, the map stays tiny for the life of the process; a periodic
 * restart (e.g. via launchd) is an acceptable reset if that ever changes.
 */
interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
  ) {}

  tryConsume(key: string, nowMs: number = Date.now()): boolean {
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, lastRefillMs: nowMs };

    const elapsedSeconds = Math.max(0, (nowMs - bucket.lastRefillMs) / 1000);
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedSeconds * this.refillPerSecond);
    bucket.lastRefillMs = nowMs;

    if (bucket.tokens < 1) {
      this.buckets.set(key, bucket);
      return false;
    }

    bucket.tokens -= 1;
    this.buckets.set(key, bucket);
    return true;
  }
}
