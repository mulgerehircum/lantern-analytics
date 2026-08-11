import { record } from "rrweb";
import { sendRecordingBatch } from "./recording-transport";

/**
 * Separate esbuild entry point, bundled into dist/tracker-recorder.js — a
 * completely different IIFE bundle from index.ts/dist/tracker.js. This file
 * is the ONLY place `rrweb` is imported anywhere in the tracker package; as
 * long as that import boundary holds, the base bundle (dist/tracker.js) can
 * never grow past its <2KB gzip target (see docs/design.md and the
 * size-check script in package.json). Loaded lazily via a <script> tag
 * injected by recording.ts's enableSessionRecording(), only when a site has
 * opted into recording — never bundled into the base tracker.
 */

const config = window.__lanternRecordConfig;

if (config) {
  // 10s / ~50KB, whichever first: keeps each flush comfortably under the
  // ~64KB practical cap shared by keepalive fetch/sendBeacon in Chromium, so
  // the final unload-time flush is never a multi-MB dump that risks being
  // dropped. visibilitychange->"hidden" is the modern, cross-platform-
  // reliable "user is leaving" signal (more reliable than beforeunload,
  // especially on mobile Safari).
  const FLUSH_INTERVAL_MS = 10_000;
  const FLUSH_SIZE_BYTES = 50 * 1024;
  const METADATA_HEARTBEAT_EVERY_N_FLUSHES = 3;

  const startedAtMs = Date.parse(config.startedAt) || Date.now();

  let buffer: unknown[] = [];
  let bufferBytes = 0;
  let seq = 0;
  let flushCount = 0;

  function flush(): void {
    if (buffer.length === 0) return;

    const events = buffer;
    buffer = [];
    bufferBytes = 0;

    const currentSeq = seq;
    seq += 1;

    sendRecordingBatch(config!.recordEndpoint, config!.siteId, config!.sessionId, config!.recordToken, currentSeq, events);

    flushCount += 1;
    if (flushCount % METADATA_HEARTBEAT_EVERY_N_FLUSHES === 0) {
      sendMetadataHeartbeat();
    }
  }

  // Small, public-endpoint payload — reuses the base tracker's own
  // sendBeacon-first transport, not recording-transport.ts's bearer-token
  // path. This endpoint is protected the same way /events is (server-side
  // EXCLUDED_IPS only, see packages/ingestion), which is a deliberate
  // asymmetry with the receiver's write token: worst-case abuse here is a
  // few extra small DynamoDB writes within free-tier capacity, not disk
  // exhaustion on owned hardware.
  function sendMetadataHeartbeat(): void {
    const body = JSON.stringify({
      siteId: config!.siteId,
      sessionId: config!.sessionId,
      startedAt: config!.startedAt,
      durationMs: Date.now() - startedAtMs,
      pageCount: config!.pageCount,
    });

    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(config!.metaEndpoint, blob)) return;
    }

    fetch(config!.metaEndpoint, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  }

  record({
    emit(event) {
      buffer.push(event);
      bufferBytes += JSON.stringify(event).length;
      if (bufferBytes >= FLUSH_SIZE_BYTES) flush();
    },
    // Non-negotiable privacy requirement (see repo root README): masking is
    // ON by default and NOT derived from any data-* attribute or config
    // field — a site owner cannot turn this off.
    maskAllInputs: true,
    maskInputOptions: { password: true, email: true, tel: true },
  });

  setInterval(flush, FLUSH_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
