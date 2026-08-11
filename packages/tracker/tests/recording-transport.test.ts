import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendRecordingBatch } from "../src/recording-transport";

describe("sendRecordingBatch", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts to <recordEndpoint>/<siteId>/<sessionId> with a bearer token and the batch body", () => {
    sendRecordingBatch("https://recorder.example.test/recordings", "site-1", "session-1", "wtoken", 3, [{ a: 1 }]);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://recorder.example.test/recordings/site-1/session-1");
    expect(init?.method).toBe("POST");
    expect(init?.keepalive).toBe(true);
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer wtoken");
    expect(JSON.parse(init?.body as string)).toEqual({ seq: 3, events: [{ a: 1 }] });
  });

  it("strips a trailing slash from recordEndpoint before joining the path", () => {
    sendRecordingBatch("https://recorder.example.test/recordings/", "site-1", "session-1", "wtoken", 0, []);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://recorder.example.test/recordings/site-1/session-1");
  });

  it("never throws when fetch rejects", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down"));
    expect(() => sendRecordingBatch("https://recorder.example.test/recordings", "s", "sess", "t", 0, [])).not.toThrow();
  });
});
