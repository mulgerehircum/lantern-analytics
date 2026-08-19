import { describe, it, expect } from "vitest";
import {
  parseEventTimestamp,
  findCustomEventsForSession,
  findSessionForEvent,
  DEFAULT_MATCH_TOLERANCE_MS,
} from "../src/lib/session-correlation";
import type { RawEventRecordWithKey } from "../src/lib/dynamodb";
import type { SessionRecordingItem } from "../src/lib/sessions";

function event(overrides: Partial<RawEventRecordWithKey> = {}): RawEventRecordWithKey {
  return {
    SK: "EVENT#2026-08-18T11:30:00Z#abc123",
    path: "/",
    country: "MD",
    device: "desktop",
    visitorHash: "hash-1",
    name: "contact_click",
    ...overrides,
  };
}

function session(overrides: Partial<SessionRecordingItem> = {}): SessionRecordingItem {
  return {
    sessionId: "s1",
    startedAt: "2026-08-18T11:30:00.000Z",
    durationMs: 60_000,
    pageCount: 1,
    storageRef: "ref1",
    visitorHash: "hash-1",
    ...overrides,
  };
}

describe("parseEventTimestamp", () => {
  it("parses a valid SK into epoch ms", () => {
    expect(parseEventTimestamp("EVENT#2026-08-18T11:30:00Z#abc123")).toBe(Date.parse("2026-08-18T11:30:00Z"));
  });

  it("returns null for a malformed SK (no # separator for the timestamp part)", () => {
    expect(parseEventTimestamp("EVENT")).toBeNull();
  });

  it("returns null when the timestamp segment doesn't parse as a date", () => {
    expect(parseEventTimestamp("EVENT#not-a-date#abc123")).toBeNull();
  });
});

describe("findCustomEventsForSession", () => {
  it("returns [] when the session has no visitorHash", () => {
    const s = session({ visitorHash: undefined });
    expect(findCustomEventsForSession(s, [event()])).toEqual([]);
  });

  it("returns [] when startedAt is unparseable", () => {
    const s = session({ startedAt: "not-a-date" });
    expect(findCustomEventsForSession(s, [event()])).toEqual([]);
  });

  it("matches an event with the same visitorHash inside the window", () => {
    const s = session();
    const e = event({ SK: "EVENT#2026-08-18T11:30:30Z#x" }); // 30s in
    const result = findCustomEventsForSession(s, [e]);
    expect(result).toHaveLength(1);
    expect(result[0].offsetMs).toBe(30_000);
  });

  it("excludes an event with a different visitorHash", () => {
    const s = session();
    const e = event({ visitorHash: "hash-2" });
    expect(findCustomEventsForSession(s, [e])).toEqual([]);
  });

  it("excludes events without a name (plain pageviews)", () => {
    const s = session();
    const e = event({ name: undefined });
    expect(findCustomEventsForSession(s, [e])).toEqual([]);
  });

  it("excludes an event outside the tolerance window", () => {
    const s = session();
    const tooEarly = event({ SK: `EVENT#${new Date(Date.parse(s.startedAt) - DEFAULT_MATCH_TOLERANCE_MS - 1000).toISOString()}#x` });
    expect(findCustomEventsForSession(s, [tooEarly])).toEqual([]);
  });

  it("includes an event exactly at the tolerance boundary", () => {
    const s = session();
    const atBoundary = event({ SK: `EVENT#${new Date(Date.parse(s.startedAt) - DEFAULT_MATCH_TOLERANCE_MS).toISOString()}#x` });
    expect(findCustomEventsForSession(s, [atBoundary])).toHaveLength(1);
  });

  it("clamps offsetMs into [0, durationMs] for an event outside the session but inside tolerance", () => {
    const s = session(); // starts 11:30:00, duration 60s -> ends 11:31:00
    const beforeStart = event({ SK: "EVENT#2026-08-18T11:29:00Z#x" }); // 1 min before start, within 5min tolerance
    const afterEnd = event({ SK: "EVENT#2026-08-18T11:32:00Z#y" }); // 1 min after end
    const result = findCustomEventsForSession(s, [beforeStart, afterEnd]);
    expect(result.map((r) => r.offsetMs)).toEqual([0, 60_000]);
  });

  it("sorts results ascending by offsetMs regardless of input order", () => {
    const s = session();
    const late = event({ SK: "EVENT#2026-08-18T11:30:40Z#a", name: "b_event" });
    const early = event({ SK: "EVENT#2026-08-18T11:30:10Z#b", name: "a_event" });
    const result = findCustomEventsForSession(s, [late, early]);
    expect(result.map((r) => r.name)).toEqual(["a_event", "b_event"]);
  });
});

describe("findSessionForEvent", () => {
  it("returns null when the event has no visitorHash", () => {
    expect(findSessionForEvent(event({ visitorHash: undefined }), [session()])).toBeNull();
  });

  it("returns null when the SK is unparseable", () => {
    expect(findSessionForEvent(event({ SK: "EVENT" }), [session()])).toBeNull();
  });

  it("returns null when no session matches (wrong visitor)", () => {
    const e = event({ visitorHash: "hash-2" });
    expect(findSessionForEvent(e, [session()])).toBeNull();
  });

  it("returns null when no session's window covers the event", () => {
    const e = event({ SK: "EVENT#2026-08-18T20:00:00Z#x" });
    expect(findSessionForEvent(e, [session()])).toBeNull();
  });

  it("finds the matching session and computes offsetMs", () => {
    const e = event({ SK: "EVENT#2026-08-18T11:30:15Z#x" });
    const match = findSessionForEvent(e, [session()]);
    expect(match?.session.sessionId).toBe("s1");
    expect(match?.offsetMs).toBe(15_000);
  });

  it("picks the first matching session in input order on an overlapping-window tie", () => {
    const e = event({ SK: "EVENT#2026-08-18T11:30:15Z#x" });
    const newer = session({ sessionId: "newer" });
    const older = session({ sessionId: "older" });
    expect(findSessionForEvent(e, [newer, older])?.session.sessionId).toBe("newer");
    expect(findSessionForEvent(e, [older, newer])?.session.sessionId).toBe("older");
  });
});
