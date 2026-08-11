import { describe, expect, it } from "vitest";
import {
  isValidSessionId,
  isValidSiteIdForPath,
  MAX_SESSION_DURATION_MS,
  MAX_SESSION_PAGE_COUNT,
  SESSION_INACTIVITY_TIMEOUT_MS,
} from "../src/recording-limits";

describe("isValidSessionId", () => {
  it("accepts a well-formed id", () => {
    expect(isValidSessionId("abc12345")).toBe(true);
    expect(isValidSessionId("a".repeat(64))).toBe(true);
  });

  it("rejects ids that are too short, too long, or contain path-unsafe characters", () => {
    expect(isValidSessionId("short")).toBe(false);
    expect(isValidSessionId("a".repeat(65))).toBe(false);
    expect(isValidSessionId("../../etc/passwd")).toBe(false);
    expect(isValidSessionId("abc 12345")).toBe(false);
    expect(isValidSessionId("")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isValidSessionId(undefined)).toBe(false);
    expect(isValidSessionId(12345678)).toBe(false);
    expect(isValidSessionId(null)).toBe(false);
  });
});

describe("isValidSiteIdForPath", () => {
  it("accepts a well-formed site id", () => {
    expect(isValidSiteIdForPath("andrii-portfolio")).toBe(true);
    expect(isValidSiteIdForPath("a")).toBe(true);
  });

  it("rejects path-traversal-shaped and oversized input", () => {
    expect(isValidSiteIdForPath("../../etc")).toBe(false);
    expect(isValidSiteIdForPath("a/b")).toBe(false);
    expect(isValidSiteIdForPath("a".repeat(65))).toBe(false);
    expect(isValidSiteIdForPath("")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isValidSiteIdForPath(undefined)).toBe(false);
    expect(isValidSiteIdForPath({})).toBe(false);
  });
});

describe("limit constants", () => {
  it("keeps a sane ordering between the inactivity timeout and the hard cap", () => {
    expect(SESSION_INACTIVITY_TIMEOUT_MS).toBeLessThan(MAX_SESSION_DURATION_MS);
    expect(MAX_SESSION_PAGE_COUNT).toBeGreaterThan(0);
  });
});
