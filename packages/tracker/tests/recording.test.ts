import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { enableSessionRecording, getOrCreateSession, getPageCount, notifyPageview, type SessionStorageLike } from "../src/recording";

function makeFakeStorage(): SessionStorageLike {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
}

function makeFakeRandom(ids: string[]) {
  let i = 0;
  return { randomUUID: () => ids[i++] ?? `fallback-${i}` };
}

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_B = "22222222-2222-2222-2222-222222222222";
const stripDashes = (uuid: string) => uuid.replace(/-/g, "");

// notifyPageview() reads/writes `window.__lanternRecordConfig`, matching
// production (always run in a real browser). This suite runs under vitest's
// node environment, so stub the minimal global every test needs.
const originalWindow = globalThis.window;

beforeEach(() => {
  // @ts-expect-error -- minimal stub is fine for this unit test
  globalThis.window = {};
});

afterEach(() => {
  globalThis.window = originalWindow;
});

describe("getOrCreateSession", () => {
  it("creates a fresh session when storage is empty", () => {
    const storage = makeFakeStorage();
    const random = makeFakeRandom([UUID_A]);
    const session = getOrCreateSession(storage, random, 1_000_000);

    expect(session.sessionId).toBe(stripDashes(UUID_A));
    expect(session.startedAt).toBe(new Date(1_000_000).toISOString());
  });

  it("reuses an existing session when still active and within the max duration", () => {
    const storage = makeFakeStorage();
    const random = makeFakeRandom([UUID_A, UUID_B]);

    const first = getOrCreateSession(storage, random, 1_000_000);
    const second = getOrCreateSession(storage, random, 1_000_000 + 60_000); // 1 min later

    expect(second.sessionId).toBe(first.sessionId);
    expect(second.startedAt).toBe(first.startedAt);
  });

  it("starts a new session after the inactivity timeout", () => {
    const storage = makeFakeStorage();
    const random = makeFakeRandom([UUID_A, UUID_B]);

    const first = getOrCreateSession(storage, random, 1_000_000);
    const second = getOrCreateSession(storage, random, 1_000_000 + 31 * 60 * 1000); // 31 min later

    expect(second.sessionId).not.toBe(first.sessionId);
    expect(second.sessionId).toBe(stripDashes(UUID_B));
  });

  it("starts a new session once the max duration is exceeded, even if active", () => {
    const storage = makeFakeStorage();
    const random = makeFakeRandom([UUID_A, UUID_B]);

    const first = getOrCreateSession(storage, random, 1_000_000);
    // Active every minute, but total elapsed exceeds the 4h hard cap.
    const fourHoursLaterPlus = 1_000_000 + 4 * 60 * 60 * 1000 + 1;
    const second = getOrCreateSession(storage, random, fourHoursLaterPlus);

    expect(second.sessionId).not.toBe(first.sessionId);
  });

  it("resets the page count when a new session starts", () => {
    const storage = makeFakeStorage();
    const random = makeFakeRandom([UUID_A]);

    getOrCreateSession(storage, random, 1_000_000);
    notifyPageview(storage);
    notifyPageview(storage);
    expect(getPageCount(storage)).toBe(2);

    // New session (far past inactivity timeout) should reset the counter.
    const random2 = makeFakeRandom([UUID_B]);
    getOrCreateSession(storage, random2, 1_000_000 + 60 * 60 * 1000);
    expect(getPageCount(storage)).toBe(0);
  });
});

describe("notifyPageview", () => {
  it("increments the persisted page count", () => {
    const storage = makeFakeStorage();
    expect(getPageCount(storage)).toBe(0);
    notifyPageview(storage);
    notifyPageview(storage);
    expect(getPageCount(storage)).toBe(2);
  });

  it("mutates window.__lanternRecordConfig.pageCount when recording is active", () => {
    const storage = makeFakeStorage();
    window.__lanternRecordConfig = {
      siteId: "s",
      sessionId: "abc",
      startedAt: new Date().toISOString(),
      pageCount: 0,
      recordEndpoint: "https://example.test",
      recordToken: "t",
      metaEndpoint: "https://example.test/meta",
    };

    notifyPageview(storage);
    expect(window.__lanternRecordConfig.pageCount).toBe(1);
  });

  it("does nothing to window when recording is not active", () => {
    const storage = makeFakeStorage();
    expect(window.__lanternRecordConfig).toBeUndefined();
    notifyPageview(storage);
    expect(window.__lanternRecordConfig).toBeUndefined();
  });
});

describe("enableSessionRecording", () => {
  it("sets window.__lanternRecordConfig and derives metaEndpoint from an absolute endpoint", () => {
    // JSDOM/happy-dom aren't configured for this package (vitest's default
    // node environment), so document.createElement/head.appendChild aren't
    // real DOM — stub just enough for this call path.
    const appended: HTMLScriptElement[] = [];
    // @ts-expect-error -- minimal stub
    globalThis.document = {
      createElement: () => ({ src: "", async: false }) as unknown as HTMLScriptElement,
      head: { appendChild: (el: HTMLScriptElement) => appended.push(el) },
    };

    enableSessionRecording(
      {
        siteId: "site-1",
        endpoint: "https://cdn.example.test/events",
        scriptSrc: "https://cdn.example.test/tracker.js",
        recordEndpoint: "https://recorder.example.test/recordings",
        recordToken: "wtoken",
      },
      { sessionId: "abc", startedAt: "2026-01-01T00:00:00.000Z" },
      1,
    );

    expect(window.__lanternRecordConfig).toEqual({
      siteId: "site-1",
      sessionId: "abc",
      startedAt: "2026-01-01T00:00:00.000Z",
      pageCount: 1,
      recordEndpoint: "https://recorder.example.test/recordings",
      recordToken: "wtoken",
      metaEndpoint: "https://cdn.example.test/session-recordings/meta",
    });
    expect(appended).toHaveLength(1);
    expect(appended[0].src).toBe("https://cdn.example.test/tracker-recorder.js");
  });

  it("degrades to no-op (never throws) when endpoint is not an absolute URL", () => {
    // @ts-expect-error -- minimal stub, appendChild must not be called
    globalThis.document = {
      createElement: () => ({ src: "", async: false }),
      head: {
        appendChild: () => {
          throw new Error("should never be called");
        },
      },
    };

    expect(() =>
      enableSessionRecording(
        {
          siteId: "site-1",
          endpoint: "/events", // relative — not resolvable without a real page origin
          scriptSrc: "/tracker.js",
          recordEndpoint: "https://recorder.example.test/recordings",
          recordToken: "wtoken",
        },
        { sessionId: "abc", startedAt: "2026-01-01T00:00:00.000Z" },
        1,
      ),
    ).not.toThrow();
    expect(window.__lanternRecordConfig).toBeUndefined();
  });

  it("does nothing when recordEndpoint/recordToken are missing", () => {
    enableSessionRecording(
      { siteId: "site-1", endpoint: "https://cdn.example.test/events", scriptSrc: "https://cdn.example.test/tracker.js" },
      { sessionId: "abc", startedAt: "2026-01-01T00:00:00.000Z" },
      1,
    );
    expect(window.__lanternRecordConfig).toBeUndefined();
  });
});
