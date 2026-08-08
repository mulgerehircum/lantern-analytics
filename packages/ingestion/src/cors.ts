/**
 * Dynamically reflects the request's actual Origin instead of a literal
 * wildcard. This endpoint has to accept traffic from arbitrary embedding
 * sites (can't allowlist ahead of time) — but `navigator.sendBeacon()`
 * always sends cross-origin requests with credentials mode "include", with
 * no way for the tracker script to opt out (a real Beacon API limitation,
 * not something we control). The CORS spec forbids a literal
 * `Access-Control-Allow-Origin: *` when credentials mode is "include" —
 * reflecting the actual Origin achieves the same "any origin allowed"
 * behavior while satisfying that rule.
 *
 * This is why CORS is handled entirely here, in code, rather than via API
 * Gateway's declarative `corsPreflight` feature: that feature requires a
 * static, known origin list once `AllowCredentials` is true, which doesn't
 * fit "any site can embed this tracker". Both the OPTIONS and POST routes
 * point at this Lambda so it has full control either way.
 *
 * No actual cookies exist for this domain (the tracker never sets any —
 * see its cookieless design), so reflecting credentials here is a CORS
 * protocol technicality, not a real credential-exposure change.
 */
export function corsHeaders(origin: string | undefined): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}
