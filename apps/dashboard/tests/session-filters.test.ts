import { describe, it, expect } from "vitest";
import { filterSessions, hasActiveSessionFilter } from "../src/lib/session-filters";

function session(overrides: Partial<{ startedAt: string; device?: string; country?: string; variant?: string; id: string }> = {}) {
  return {
    id: "default",
    startedAt: "2026-08-15T10:00:00.000Z",
    device: "desktop",
    country: "MD",
    variant: "video",
    ...overrides,
  };
}

describe("hasActiveSessionFilter", () => {
  it("is false when nothing is set", () => {
    expect(hasActiveSessionFilter({})).toBe(false);
  });

  it("is true when any single field is set", () => {
    expect(hasActiveSessionFilter({ device: "mobile" })).toBe(true);
    expect(hasActiveSessionFilter({ from: "2026-08-01" })).toBe(true);
  });
});

describe("filterSessions", () => {
  it("returns everything when no filter is set", () => {
    const sessions = [session({ id: "a" }), session({ id: "b" })];
    expect(filterSessions(sessions, {})).toEqual(sessions);
  });

  it("filters by variant exactly", () => {
    const sessions = [session({ id: "a", variant: "video" }), session({ id: "b", variant: "iframe" })];
    expect(filterSessions(sessions, { variant: "iframe" }).map((s) => s.id)).toEqual(["b"]);
  });

  it("filters by device exactly", () => {
    const sessions = [session({ id: "a", device: "desktop" }), session({ id: "b", device: "mobile" })];
    expect(filterSessions(sessions, { device: "mobile" }).map((s) => s.id)).toEqual(["b"]);
  });

  it("filters by country exactly", () => {
    const sessions = [session({ id: "a", country: "MD" }), session({ id: "b", country: "US" })];
    expect(filterSessions(sessions, { country: "US" }).map((s) => s.id)).toEqual(["b"]);
  });

  it("filters by inclusive date range on startedAt's date portion", () => {
    const sessions = [
      session({ id: "a", startedAt: "2026-08-10T23:59:00.000Z" }),
      session({ id: "b", startedAt: "2026-08-15T00:00:00.000Z" }),
      session({ id: "c", startedAt: "2026-08-20T12:00:00.000Z" }),
    ];
    expect(filterSessions(sessions, { from: "2026-08-12", to: "2026-08-18" }).map((s) => s.id)).toEqual(["b"]);
  });

  it("treats from/to bounds as inclusive", () => {
    const sessions = [session({ id: "a", startedAt: "2026-08-15T00:00:00.000Z" })];
    expect(filterSessions(sessions, { from: "2026-08-15", to: "2026-08-15" }).map((s) => s.id)).toEqual(["a"]);
  });

  it("combines multiple filters with AND semantics", () => {
    const sessions = [
      session({ id: "a", device: "mobile", country: "US" }),
      session({ id: "b", device: "mobile", country: "MD" }),
      session({ id: "c", device: "desktop", country: "US" }),
    ];
    expect(filterSessions(sessions, { device: "mobile", country: "US" }).map((s) => s.id)).toEqual(["a"]);
  });
});
