import type { PageviewEvent } from "@lantern/shared";
import { HEATMAP_CLICK_EVENT_NAME } from "@lantern/shared";
import { readConfig } from "./config";
import { sendBeacon } from "./beacon";
import { getReferrerHostname } from "./referrer";
import { isNewVisit } from "./visit";
import { isDoNotTrackEnabled } from "./dnt";
import { isIgnored, setIgnored } from "./ignore";
import { buildCustomEvent } from "./track";
import { enableSpaTracking } from "./spa";
import { enableSessionRecording, getOrCreateSession, getPageCount, notifyPageview } from "./recording";
import { computeClickPercent } from "./heatmap";
import { reportFrameDimensions, reportFrameScroll } from "./frame-report";

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

function trackPageview(path: string = location.pathname, newVisit: boolean = false): void {
  if (!config) return;

  const event: PageviewEvent = {
    siteId: config.siteId,
    path,
    referrer: getReferrerHostname(),
    timestamp: new Date().toISOString(),
    isNewVisit: newVisit,
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
// opt-out flag, see ignore.ts). `isNewVisit()` (visit.ts) is evaluated only
// here, for the true initial load — it's a stateless read of the browser's
// own navigation-timing + referrer, not a client-side identity of any kind.
// See docs/design.md for the full reasoning behind what this deliberately
// does NOT do.
if (!isDoNotTrackEnabled() && !isIgnored()) {
  trackPageview(location.pathname, isNewVisit());
  notifyPageview(sessionStorage);
}

// Opt-in SPA route tracking (`data-spa` on the script tag): fires a pageview
// per client-side navigation, deduped by pathname. DNT/ignore are re-checked
// per navigation, matching window.lantern.track.
if (config?.spa) {
  enableSpaTracking(
    window,
    (path) => {
      trackPageview(path);
      notifyPageview(sessionStorage);
    },
    () => !isDoNotTrackEnabled() && !isIgnored(),
  );
}

// Opt-in session recording (`data-record` + `data-record-endpoint` +
// `data-record-token` on the script tag). Same DNT/ignore standard as
// pageviews/custom events — no separate or weaker gate. See recording.ts for
// why this loads a completely separate script rather than importing rrweb
// here.
if (config?.recordEnabled && !isDoNotTrackEnabled() && !isIgnored()) {
  const session = getOrCreateSession(sessionStorage, crypto);
  enableSessionRecording(config, session, getPageCount(sessionStorage));
}

// Opt-in heatmap click tracking (`data-heatmap` on the script tag): fires a
// reserved-name custom event per click with a page-relative position, and —
// only when actually embedded in an iframe — reports this page's real
// dimensions and live scroll position to the parent, so the dashboard's
// overlay can size itself and keep its dots pinned to the right spot as the
// iframe scrolls. Same DNT/ignore standard as everything else.
if (config?.heatmap && !isDoNotTrackEnabled() && !isIgnored()) {
  document.addEventListener("click", (e) => {
    track(HEATMAP_CLICK_EVENT_NAME, computeClickPercent(e, document.documentElement));
  });
  reportFrameDimensions(window, document);
  reportFrameScroll(window);
}
