/**
 * Country resolver — stubbed for now, on purpose. Real IP geolocation needs
 * either a bundled database (MaxMind GeoLite2, ~70MB, awkward to ship in a
 * Lambda zip) or an external API call on every ingest request (adds latency
 * and a third-party dependency to the hot path). Deferred until there's a
 * reason to pick one deliberately rather than defaulting into it — this is
 * the same "don't build ahead of a real need" call as the AI query layer.
 * Raw IP is discarded immediately after this call regardless of which
 * resolver eventually lands here; it is never persisted.
 */
export function resolveCountry(_ip: string): string {
  return "unknown";
}
