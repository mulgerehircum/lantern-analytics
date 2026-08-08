import type { PageviewEvent } from "@lantern/shared";
import { readConfig } from "./config";
import { sendBeacon } from "./beacon";
import { getReferrerHostname } from "./referrer";
import { isDoNotTrackEnabled } from "./dnt";

/**
 * Entry point. Runs once, synchronously, at script load — no cookies, no
 * localStorage identity, no client-side hashing (uniqueness is derived
 * server-side from IP + UA, see packages/ingestion). See docs/design.md for
 * the full reasoning behind what this deliberately does NOT do.
 */
function track(): void {
  if (isDoNotTrackEnabled()) return;

  const config = readConfig();
  if (!config) return; // missing data-site-id/data-endpoint — fail silently on the host page

  const event: PageviewEvent = {
    siteId: config.siteId,
    path: location.pathname,
    referrer: getReferrerHostname(),
    timestamp: new Date().toISOString(),
  };

  sendBeacon(config.endpoint, event);
}

track();
