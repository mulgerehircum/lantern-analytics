import { describe, it, expect } from "vitest";
import { parseSessionRecordingMeta } from "../src/session-meta-validate";
import { MAX_SESSION_DURATION_MS, MAX_SESSION_PAGE_COUNT } from "@lantern/shared";

const validBody = JSON.stringify({
  siteId: "site-1",
  sessionId: "abc12345xyz0",
  startedAt: "2026-08-08T10:00:00.000Z",
  durationMs: 12000,
  pageCount: 2,
  path: "/pricing",
  referrer: "google.com",
});

describe("parseSessionRecordingMeta", () => {
  it("accepts a well-formed payload and computes storageRef server-side", () => {
    expect(parseSessionRecordingMeta(validBody)).toEqual({
      siteId: "site-1",
      sessionId: "abc12345xyz0",
      startedAt: "2026-08-08T10:00:00.000Z",
      durationMs: 12000,
      pageCount: 2,
      storageRef: "site-1/abc12345xyz0",
      path: "/pricing",
      referrer: "google.com",
    });
  });

  it("accepts an empty-string referrer (direct traffic)", () => {
    const body = JSON.stringify({ ...JSON.parse(validBody), referrer: "" });
    expect(parseSessionRecordingMeta(body)?.referrer).toBe("");
  });

  it("rejects a missing path", () => {
    const { path, ...rest } = JSON.parse(validBody);
    expect(parseSessionRecordingMeta(JSON.stringify(rest))).toBeNull();
  });

  it("rejects a missing referrer", () => {
    const { referrer, ...rest } = JSON.parse(validBody);
    expect(parseSessionRecordingMeta(JSON.stringify(rest))).toBeNull();
  });

  it("ignores a client-supplied storageRef and recomputes it", () => {
    const body = JSON.stringify({
      siteId: "site-1",
      sessionId: "abc12345xyz0",
      startedAt: "2026-08-08T10:00:00.000Z",
      durationMs: 12000,
      pageCount: 2,
      path: "/pricing",
      referrer: "google.com",
      storageRef: "../../etc/passwd",
    });
    expect(parseSessionRecordingMeta(body)?.storageRef).toBe("site-1/abc12345xyz0");
  });

  it("rejects undefined body", () => {
    expect(parseSessionRecordingMeta(undefined)).toBeNull();
  });

  it("rejects invalid JSON", () => {
    expect(parseSessionRecordingMeta("{not json")).toBeNull();
  });

  it("rejects a non-object payload", () => {
    expect(parseSessionRecordingMeta(JSON.stringify("just a string"))).toBeNull();
  });

  it("rejects a path-traversal-shaped siteId", () => {
    const body = JSON.stringify({ ...JSON.parse(validBody), siteId: "../../etc" });
    expect(parseSessionRecordingMeta(body)).toBeNull();
  });

  it("rejects a malformed sessionId", () => {
    const body = JSON.stringify({ ...JSON.parse(validBody), sessionId: "short" });
    expect(parseSessionRecordingMeta(body)).toBeNull();
  });

  it("rejects an unparseable startedAt", () => {
    const body = JSON.stringify({ ...JSON.parse(validBody), startedAt: "not-a-date" });
    expect(parseSessionRecordingMeta(body)).toBeNull();
  });

  it("rejects a negative durationMs", () => {
    const body = JSON.stringify({ ...JSON.parse(validBody), durationMs: -1 });
    expect(parseSessionRecordingMeta(body)).toBeNull();
  });

  it(`rejects durationMs over the ${MAX_SESSION_DURATION_MS}ms cap`, () => {
    const body = JSON.stringify({ ...JSON.parse(validBody), durationMs: MAX_SESSION_DURATION_MS + 1 });
    expect(parseSessionRecordingMeta(body)).toBeNull();
  });

  it("rejects a zero or negative pageCount", () => {
    const body = JSON.stringify({ ...JSON.parse(validBody), pageCount: 0 });
    expect(parseSessionRecordingMeta(body)).toBeNull();
  });

  it(`rejects pageCount over the ${MAX_SESSION_PAGE_COUNT} cap`, () => {
    const body = JSON.stringify({ ...JSON.parse(validBody), pageCount: MAX_SESSION_PAGE_COUNT + 1 });
    expect(parseSessionRecordingMeta(body)).toBeNull();
  });

  it("rejects wrong types for known fields", () => {
    const body = JSON.stringify({ ...JSON.parse(validBody), durationMs: "12000" });
    expect(parseSessionRecordingMeta(body)).toBeNull();
  });
});
