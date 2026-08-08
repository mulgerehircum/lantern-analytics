/**
 * `sendBeacon` is the right tool here: fire-and-forget, survives page unload,
 * no response expected. Falls back to `fetch(..., { keepalive: true })` only
 * when `sendBeacon` is unavailable or rejects the payload outright (very old
 * browsers, or a payload over the browser's beacon size cap).
 *
 * A dropped analytics beacon must never surface an error to the host page —
 * every failure path here is silently swallowed by design.
 */
export function sendBeacon(endpoint: string, payload: unknown): void {
  const body = JSON.stringify(payload);

  if (typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(endpoint, blob)) return;
  }

  fetch(endpoint, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => {
    // Intentionally ignored — see doc comment above.
  });
}
