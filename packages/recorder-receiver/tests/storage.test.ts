import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendBatch, readSession } from "../src/storage";

let dataDir: string;

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "lantern-recorder-"));
});

afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe("appendBatch / readSession", () => {
  it("round-trips a single batch", async () => {
    const result = await appendBatch(dataDir, "site-a", "session-1", { seq: 0, events: [{ type: 1 }] }, 1024 * 1024);
    expect(result.ok).toBe(true);

    const session = await readSession(dataDir, "site-a", "session-1");
    expect(session).toEqual({ events: [{ type: 1 }] });
  });

  it("reassembles multiple batches in seq order even when appended out of order", async () => {
    await appendBatch(dataDir, "site-a", "session-1", { seq: 1, events: ["b"] }, 1024 * 1024);
    await appendBatch(dataDir, "site-a", "session-1", { seq: 0, events: ["a"] }, 1024 * 1024);
    await appendBatch(dataDir, "site-a", "session-1", { seq: 2, events: ["c"] }, 1024 * 1024);

    const session = await readSession(dataDir, "site-a", "session-1");
    expect(session?.events).toEqual(["a", "b", "c"]);
  });

  it("tolerates a corrupt/torn trailing line", async () => {
    await appendBatch(dataDir, "site-a", "session-1", { seq: 0, events: ["a"] }, 1024 * 1024);

    const filePath = path.join(dataDir, "site-a", "session-1.jsonl");
    await fs.appendFile(filePath, '{"seq":1,"events":["b"'); // torn, no closing brace

    const session = await readSession(dataDir, "site-a", "session-1");
    expect(session?.events).toEqual(["a"]);
  });

  it("rejects a batch that would push the session file past the size cap", async () => {
    const smallCap = 50; // bytes — small enough that even one batch overflows it
    const result = await appendBatch(dataDir, "site-a", "session-1", { seq: 0, events: [{ big: "x".repeat(200) }] }, smallCap);
    expect(result).toEqual({ ok: false, reason: "too-large" });
  });

  it("returns null for a session that was never written", async () => {
    const session = await readSession(dataDir, "site-a", "does-not-exist");
    expect(session).toBeNull();
  });

  it("keeps different sessions in separate files", async () => {
    await appendBatch(dataDir, "site-a", "session-1", { seq: 0, events: ["one"] }, 1024 * 1024);
    await appendBatch(dataDir, "site-a", "session-2", { seq: 0, events: ["two"] }, 1024 * 1024);

    expect((await readSession(dataDir, "site-a", "session-1"))?.events).toEqual(["one"]);
    expect((await readSession(dataDir, "site-a", "session-2"))?.events).toEqual(["two"]);
  });
});
