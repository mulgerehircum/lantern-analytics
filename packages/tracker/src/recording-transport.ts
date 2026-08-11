/**
 * Sends one rrweb event batch to the Mac-mini receiver. Deliberately NOT
 * `beacon.ts`'s `sendBeacon()`: that caps around 64KB and can't carry a
 * custom `Authorization` header, and recording batches need both — a real
 * header for the (public, non-secret) write token, and headroom for batches
 * larger than sendBeacon's cap (see `keepalive` param doc below).
 *
 * Same "never surface an error to the host page" discipline as beacon.ts —
 * a dropped recording batch must never throw into the visited site's page.
 */
export function sendRecordingBatch(
  recordEndpoint: string,
  siteId: string,
  sessionId: string,
  token: string,
  seq: number,
  events: unknown[],
  // Real production incident: a rrweb FullSnapshot event (always the first
  // event of a session, often 50-200KB+ for a DOM-heavy page) reliably
  // triggered "Failed to fetch" with keepalive:true — Chromium enforces a
  // combined ~64KB body-size quota across in-flight keepalive requests, and
  // the seq-0 batch (the one carrying the snapshot every other event needs
  // to render against) was silently dropped by every session, every time,
  // producing a permanently blank replay. keepalive only matters for a
  // request that must survive page unload; only flushFinal() (fired on
  // visibilitychange->"hidden") is actually in that situation, so it's the
  // only caller that should pay this cap. Every other flush happens while
  // the page is still alive, where an ordinary fetch has no such body limit.
  keepalive: boolean,
): void {
  const url = `${recordEndpoint.replace(/\/$/, "")}/${siteId}/${sessionId}`;

  fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ seq, events }),
    keepalive,
  }).catch(() => {
    // Intentionally ignored — see doc comment above.
  });
}
