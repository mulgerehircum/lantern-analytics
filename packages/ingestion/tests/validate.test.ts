import { describe, it, expect } from "vitest";
import { parsePageviewEvent } from "../src/validate";

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
    });
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
