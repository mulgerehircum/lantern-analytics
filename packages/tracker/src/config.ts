export interface TrackerConfig {
  siteId: string;
  endpoint: string;
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

  return { siteId, endpoint };
}
