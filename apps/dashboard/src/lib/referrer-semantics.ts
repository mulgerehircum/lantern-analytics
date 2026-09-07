/**
 * Flat static registry of what known REFERRER hostnames actually are, keyed
 * only by hostname - the referrer-side twin of event-semantics.ts, and for
 * the same reason: raw names alone mislead. The model saw
 * "portfolios.anav.dev" and produced "reach out to the owner of
 * portfolios.anav.dev to establish a partnership" - but that hostname is a
 * personal proxy fronting a static GitHub list; there is no owner, and the
 * action rests entirely on a premise the name invented (the data only ever
 * says where traffic came from, never who operates the source).
 *
 * Same ownership note as event-semantics.ts: the tracker's author owns
 * every site this registry describes. If referrer meaning ever needs to be
 * per-site, promote entries to SiteInfo then.
 */

export type ReferrerKind = "static-list-proxy";

export interface ReferrerSemantics {
  kind: ReferrerKind;
  /** One plain sentence of interpretation, injected verbatim into the insights prompt. */
  note: string;
}

export const REFERRER_SEMANTICS: Record<string, ReferrerSemantics> = {
  "portfolios.anav.dev": {
    kind: "static-list-proxy",
    note: "A personal proxy fronting the public static developer-portfolios list (github.com/emmabostian/developer-portfolios). Traffic from it means the site is listed on that list - nobody curates or operates content behind this hostname, there is no owner to contact, and no partnership is possible.",
  },
};

/**
 * Renders the referrer semantics block for the insights prompt: one line
 * per KNOWN hostname that actually appears in the data. Unknown hostnames
 * get nothing - the prompt's hard rules already forbid premising actions
 * on reaching whoever runs a referrer.
 */
export function renderReferrerSemantics(referrers: string[]): string | null {
  const known = [...new Set(referrers)].filter((name) => REFERRER_SEMANTICS[name]).sort();
  if (known.length === 0) return null;
  const lines = known.map((name) => `- ${name}: ${REFERRER_SEMANTICS[name].note}`);
  return lines.join("\n");
}

/** Semantic lookup for eval validators and prompt rendering. */
export function getReferrerSemantics(name: string): ReferrerSemantics | undefined {
  return REFERRER_SEMANTICS[name];
}
