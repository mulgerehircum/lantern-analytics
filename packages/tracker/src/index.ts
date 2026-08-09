import type { PageviewEvent } from "@lantern/shared";
import { readConfig } from "./config";
import { sendBeacon } from "./beacon";
import { getReferrerHostname } from "./referrer";
import { isDoNotTrackEnabled } from "./dnt";
import { isIgnored, setIgnored } from "./ignore";
import { buildCustomEvent } from "./track";
import { enableSpaTracking } from "./spa";

declare global {
  interface Window {
    lantern?: {
      track: (name: string, metadata?: Record<string, string | number | boolean>) => void;
      ignore: () => void;
    };
  }
}

/**
 * Config is read once at script load (document.currentScript only resolves
 * while the script is executing) and cached in module scope so later
 * `window.lantern.track(...)` calls can use it without re-reading.
 */
const config = readConfig();

function trackPageview(path: string = location.pathname): void {
  if (!config) return;

  const event: PageviewEvent = {
    siteId: config.siteId,
    path,
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
  if (isDoNotTrackEnabled() || isIgnored()) return;
  if (!config) return;

  const event = buildCustomEvent(config.siteId, name, metadata);
  if (!event) return;

  sendBeacon(config.endpoint, event);
}

window.lantern = { track, ignore: setIgnored };

// Entry point — runs once, synchronously, at script load. No cookies, no
// localStorage identity (the one exception is the owner-set `lantern_ignore`
// opt-out flag, see ignore.ts), no client-side hashing (uniqueness is derived
// server-side from IP + UA, see packages/ingestion). See docs/design.md for
// the full reasoning behind what this deliberately does NOT do.
if (!isDoNotTrackEnabled() && !isIgnored()) {
  trackPageview();
}

// Opt-in SPA route tracking (`data-spa` on the script tag): fires a pageview
// per client-side navigation, deduped by pathname. DNT/ignore are re-checked
// per navigation, matching window.lantern.track.
if (config?.spa) {
  enableSpaTracking(window, trackPageview, () => !isDoNotTrackEnabled() && !isIgnored());
}
