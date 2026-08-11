/**
 * Sends one rrweb event batch to the Mac-mini receiver. Deliberately NOT
 * `beacon.ts`'s `sendBeacon()`: that caps around 64KB and can't carry a
 * custom `Authorization` header, and recording batches need both — a real
 * header for the (public, non-secret) write token, and headroom up to the
 * ~50KB proactive flush threshold (see recorder-entry.ts). `keepalive: true`
 * gives the same "survives page unload" property sendBeacon has.
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
): void {
  const url = `${recordEndpoint.replace(/\/$/, "")}/${siteId}/${sessionId}`;

  fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ seq, events }),
    keepalive: true,
  }).catch(() => {
    // Intentionally ignored — see doc comment above.
  });
}
