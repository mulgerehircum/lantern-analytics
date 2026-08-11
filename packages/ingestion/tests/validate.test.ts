import { describe, it, expect } from "vitest";
import { parsePageviewEvent, parseTrackedEvent } from "../src/validate";
import { MAX_EVENT_NAME_LENGTH, MAX_METADATA_KEYS } from "@lantern/shared";

const validBody = JSON.stringify({
  siteId: "site-1",
  path: "/pricing",
  referrer: "google.com",
  timestamp: "2026-08-08T10:00:00.000Z",
});

describe("parsePageviewEvent", () => {
  it("accepts a well-formed payload", () => {
    expect(parsePageviewEvent(validBody)).toEqual({
      siteId: "site-1",
      path: "/pricing",
      referrer: "google.com",
      timestamp: "2026-08-08T10:00:00.000Z",
      isNewVisit: false,
    });
  });

  it("accepts isNewVisit: true", () => {
    const body = JSON.stringify({ ...JSON.parse(validBody), isNewVisit: true });
    expect(parsePageviewEvent(body)?.isNewVisit).toBe(true);
  });

  it("defaults isNewVisit to false when absent", () => {
    expect(parsePageviewEvent(validBody)?.isNewVisit).toBe(false);
  });

  it("defaults isNewVisit to false for any non-true value (tamper-resistant)", () => {
    const body = JSON.stringify({ ...JSON.parse(validBody), isNewVisit: "true" });
    expect(parsePageviewEvent(body)?.isNewVisit).toBe(false);
  });

  it("rejects undefined body", () => {
    expect(parsePageviewEvent(undefined)).toBeNull();
  });

  it("rejects invalid JSON", () => {
    expect(parsePageviewEvent("{not json")).toBeNull();
  });

  it("rejects a non-object payload", () => {
    expect(parsePageviewEvent(JSON.stringify("just a string"))).toBeNull();
  });

  it("rejects a missing siteId", () => {
    const body = JSON.stringify({ path: "/x", referrer: "", timestamp: "2026-08-08T10:00:00.000Z" });
    expect(parsePageviewEvent(body)).toBeNull();
  });

  it("rejects an empty siteId", () => {
    const body = JSON.stringify({ siteId: "", path: "/x", referrer: "", timestamp: "2026-08-08T10:00:00.000Z" });
    expect(parsePageviewEvent(body)).toBeNull();
  });

  it("rejects an unparseable timestamp", () => {
    const body = JSON.stringify({ siteId: "s", path: "/x", referrer: "", timestamp: "not-a-date" });
    expect(parsePageviewEvent(body)).toBeNull();
  });

  it("rejects wrong types for known fields", () => {
    const body = JSON.stringify({ siteId: 123, path: "/x", referrer: "", timestamp: "2026-08-08T10:00:00.000Z" });
    expect(parsePageviewEvent(body)).toBeNull();
  });
});

describe("parseTrackedEvent", () => {
  const pageviewBody = JSON.stringify({
    siteId: "site-1",
    path: "/",
    referrer: "google.com",
    timestamp: "2026-08-08T10:00:00.000Z",
  });

  it("accepts a pageview payload", () => {
    expect(parseTrackedEvent(pageviewBody)).toEqual({
      siteId: "site-1",
      path: "/",
      referrer: "google.com",
      timestamp: "2026-08-08T10:00:00.000Z",
      isNewVisit: false,
    });
  });

  it("accepts a custom event with metadata", () => {
    const body = JSON.stringify({
      siteId: "site-1",
      name: "contact_click",
      path: "/contact",
      metadata: { platform: "email" },
      timestamp: "2026-08-08T10:00:00.000Z",
    });
    expect(parseTrackedEvent(body)).toEqual({
      siteId: "site-1",
      name: "contact_click",
      path: "/contact",
      metadata: { platform: "email" },
      timestamp: "2026-08-08T10:00:00.000Z",
    });
  });

  it("accepts a custom event without metadata", () => {
    const body = JSON.stringify({
      siteId: "site-1",
      name: "section_view",
      path: "/",
      timestamp: "2026-08-08T10:00:00.000Z",
    });
    expect(parseTrackedEvent(body)).toEqual({
      siteId: "site-1",
      name: "section_view",
      path: "/",
      metadata: {},
      timestamp: "2026-08-08T10:00:00.000Z",
    });
  });

  it("rejects an empty event name", () => {
    const body = JSON.stringify({
      siteId: "site-1",
      name: "",
      path: "/",
      timestamp: "2026-08-08T10:00:00.000Z",
    });
    expect(parseTrackedEvent(body)).toBeNull();
  });

  it(`rejects an event name longer than ${MAX_EVENT_NAME_LENGTH} chars`, () => {
    const body = JSON.stringify({
      siteId: "site-1",
      name: "x".repeat(MAX_EVENT_NAME_LENGTH + 1),
      path: "/",
      timestamp: "2026-08-08T10:00:00.000Z",
    });
    expect(parseTrackedEvent(body)).toBeNull();
  });

  it("rejects non-object metadata", () => {
    const body = JSON.stringify({
      siteId: "site-1",
      name: "click",
      path: "/",
      metadata: [1, 2],
      timestamp: "2026-08-08T10:00:00.000Z",
    });
    expect(parseTrackedEvent(body)).toBeNull();
  });

  it("rejects unsupported metadata value types", () => {
    const body = JSON.stringify({
      siteId: "site-1",
      name: "click",
      path: "/",
      metadata: { obj: { nested: true } },
      timestamp: "2026-08-08T10:00:00.000Z",
    });
    expect(parseTrackedEvent(body)).toBeNull();
  });

  it(`rejects metadata with more than ${MAX_METADATA_KEYS} keys`, () => {
    const metadata: Record<string, string> = {};
    for (let i = 0; i < MAX_METADATA_KEYS + 1; i++) metadata[`key${i}`] = "v";
    const body = JSON.stringify({
      siteId: "site-1",
      name: "click",
      path: "/",
      metadata,
      timestamp: "2026-08-08T10:00:00.000Z",
    });
    expect(parseTrackedEvent(body)).toBeNull();
  });
});
