import { promises as fs } from "node:fs";
import * as path from "node:path";

/**
 * Flat-file (JSON Lines) storage for rrweb session blobs — one file per
 * (siteId, sessionId), one line per received upload batch. Chosen over a
 * database because the access pattern is exact-key-only (give me the blob for
 * this siteId+sessionId, nothing else) and DynamoDB already owns the
 * queryable index (session list, chronological sort) — see docs/decisions.md
 * in the repo root for the full rationale.
 */

export interface RecordingBatch {
  seq: number;
  events: unknown[];
}

interface StoredLine extends RecordingBatch {
  receivedAt: string;
}

function sessionFilePath(dataDir: string, siteId: string, sessionId: string): string {
  return path.join(dataDir, siteId, `${sessionId}.jsonl`);
}

export type AppendResult = { ok: true } | { ok: false; reason: "too-large" };

/**
 * Appends one batch as a JSON line. Enforces a per-session file-size cap so a
 * single session (or a targeted abuser who has read the public write token
 * out of the shipped tracker JS, see README.md) can't grow without bound —
 * this cap, not the token, is the real defense against filling this
 * machine's disk.
 */
export async function appendBatch(
  dataDir: string,
  siteId: string,
  sessionId: string,
  batch: RecordingBatch,
  maxFileSizeBytes: number,
): Promise<AppendResult> {
  const dir = path.join(dataDir, siteId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = sessionFilePath(dataDir, siteId, sessionId);

  let currentSize = 0;
  try {
    currentSize = (await fs.stat(filePath)).size;
  } catch {
    currentSize = 0; // file doesn't exist yet — first batch for this session
  }

  const line: StoredLine = { ...batch, receivedAt: new Date().toISOString() };
  const serialized = JSON.stringify(line) + "\n";
  if (currentSize + Buffer.byteLength(serialized) > maxFileSizeBytes) {
    return { ok: false, reason: "too-large" };
  }

  await fs.appendFile(filePath, serialized, "utf8");
  return { ok: true };
}

/**
 * Reads back a session's full event stream, reassembled in `seq` order
 * (batches can arrive out of order under retry/network conditions). Tolerates
 * a torn trailing line — the one thing a crash mid-append can produce — by
 * skipping any line that doesn't parse rather than failing the whole read.
 */
export async function readSession(
  dataDir: string,
  siteId: string,
  sessionId: string,
): Promise<{ events: unknown[] } | null> {
  const filePath = sessionFilePath(dataDir, siteId, sessionId);

  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }

  const batches: StoredLine[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (typeof parsed?.seq === "number" && Array.isArray(parsed?.events)) {
        batches.push(parsed);
      }
    } catch {
      // Corrupt/torn line — skip it, don't fail the whole read.
    }
  }

  batches.sort((a, b) => a.seq - b.seq);
  return { events: batches.flatMap((b) => b.events) };
}
