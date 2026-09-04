/**
 * Country flag, keyed by ISO 3166-1 alpha-2 (lowercase). Self-hosted copies
 * of FlagCDN's w20 PNGs in /public/flags (see scripts/fetch-flags.mjs) -
 * same-origin so the browser caches them deterministically and no
 * third-party CDN sees dashboard traffic. Served with a 1-year immutable
 * Cache-Control (next.config.mjs headers) - flags never change content for
 * a given code.
 */
export function CountryLabel({ code }: { code: string }) {
  if (!code || code.length !== 2) return <>{code || "(empty)"}</>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
      <img src={`/flags/${code.toLowerCase()}.png`} alt={`${code} flag`} width={16} height={12} loading="lazy" style={{ borderRadius: 2 }} />
      {code}
    </span>
  );
}
