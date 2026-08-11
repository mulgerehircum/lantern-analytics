export interface TrackerConfig {
  siteId: string;
  endpoint: string;
  /** True when the script tag carries `data-spa`: fire a pageview per client-side route change. */
  spa: boolean;
  /** This script's own resolved `src` — used to derive the lazy recording chunk's URL. */
  scriptSrc: string;
  /**
   * True only when `data-record` is present AND both `data-record-endpoint`/
   * `data-record-token` are set. A misconfigured recording opt-in must never
   * break the base pageview beacon, so this fails closed rather than
   * throwing or half-enabling recording — see recording.ts.
   */
  recordEnabled: boolean;
  recordEndpoint?: string;
  recordToken?: string;
  /** `data-record-script` — explicit override for the lazy chunk's URL, for
   * sites that host tracker.js and tracker-recorder.js at different paths. */
  recordScript?: string;
}

/**
 * Reads `data-site-id` and `data-endpoint` off the `<script>` tag that loaded
 * this file. `document.currentScript` only resolves correctly while the script
 * is executing synchronously at load time — this must be called eagerly, not
 * deferred into an event handler.
 */
export function readConfig(): TrackerConfig | null {
  const script = document.currentScript as HTMLScriptElement | null;
  if (!script) return null;

  const siteId = script.dataset.siteId;
  const endpoint = script.dataset.endpoint;
  if (!siteId || !endpoint) return null;

  const recordEndpoint = script.dataset.recordEndpoint;
  const recordToken = script.dataset.recordToken;

  return {
    siteId,
    endpoint,
    spa: script.dataset.spa !== undefined,
    scriptSrc: script.src,
    recordEnabled: script.dataset.record !== undefined && !!recordEndpoint && !!recordToken,
    recordEndpoint,
    recordToken,
    recordScript: script.dataset.recordScript,
  };
}
