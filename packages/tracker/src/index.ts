import type { PageviewEvent } from "@lantern/shared";
import { readConfig } from "./config";
import { sendBeacon } from "./beacon";
import { getReferrerHostname } from "./referrer";
import { isDoNotTrackEnabled } from "./dnt";
import { buildCustomEvent } from "./track";

declare global {
  interface Window {
    lantern?: { track: (name: string, metadata?: Record<string, string | number | boolean>) => void };
  }
}

/**
 * Config is read once at script load (document.currentScript only resolves
 * while the script is executing) and cached in module scope so later
 * `window.lantern.track(...)` calls can use it without re-reading.
 */
const config = readConfig();

function trackPageview(): void {
  if (!config) return;

  const event: PageviewEvent = {
    siteId: config.siteId,
    path: location.pathname,
    referrer: getReferrerHostname(),
    timestamp: new Date().toISOString(),
  };

  sendBeacon(config.endpoint, event);
}

/**
 * Public custom-event API: `window.lantern.track("contact_click", { platform: "email" })`.
 * Fails silently on bad input or DNT — a dropped analytics call must never
 * surface an error to the host page.
 */
function track(name: string, metadata?: Record<string, string | number | boolean>): void {
  if (isDoNotTrackEnabled()) return;
  if (!config) return;

  const event = buildCustomEvent(config.siteId, name, metadata);
  if (!event) return;

  sendBeacon(config.endpoint, event);
}

window.lantern = { track };

// Entry point — runs once, synchronously, at script load. No cookies, no
// localStorage identity, no client-side hashing (uniqueness is derived
// server-side from IP + UA, see packages/ingestion). See docs/design.md for
// the full reasoning behind what this deliberately does NOT do.
if (!isDoNotTrackEnabled()) {
  trackPageview();
}
