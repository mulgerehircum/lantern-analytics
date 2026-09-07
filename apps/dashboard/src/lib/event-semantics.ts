/**
 * Flat static registry of what each known custom-event NAME means, keyed
 * only by event name - no per-site entries on purpose (YAGNI: every site
 * in sites.ts runs the same tracker this vocabulary comes from, and its
 * author owns all of them). If a name ever comes to mean different things
 * on different sites, promote that one entry to a per-site override on
 * SiteInfo then - the escape hatch is deliberate, not built yet.
 *
 * Exists because raw event names alone mislead: "card_variant_view" is an
 * A/B experiment impression (fires once per card render on every page
 * load), NOT engagement - the model lumped it in with section views as
 * "engagement" and produced a hollow insight from it (see eval/insights).
 * This registry is what lets both the insights prompt and the eval
 * validators interpret event names correctly.
 */

export type EventKind = "impression" | "experiment-impression" | "click" | "download";

export interface EventSemantics {
  kind: EventKind;
  /** For impression-kind events: the click/download events that respond to this exposure. CTR = paired / impression. */
  pairsWith?: string[];
  /** One plain sentence of interpretation, injected verbatim into the insights prompt. */
  note: string;
}

export const EVENT_SEMANTICS: Record<string, EventSemantics> = {
  card_variant_view: {
    kind: "experiment-impression",
    pairsWith: ["project_link_click", "iframe_expand_click"],
    note: "A/B experiment impression - fires once per project-card render on every page load. Measures EXPOSURE, not engagement; it is the denominator for the experiment's click-through rate (see the Experiments view), never a signal of interest on its own.",
  },
  section_view: {
    kind: "impression",
    note: "Passive section impression - fires when a section scrolls into view, not on any visitor action. Counts scroll-past exposure, not reading or interest.",
  },
  project_link_click: {
    kind: "click",
    note: "A real click on a project card's link (live site or GitHub) - a genuine engagement response to the card_variant_view experiment exposure.",
  },
  iframe_expand_click: {
    kind: "click",
    note: "A real click expanding the live-site iframe modal - a genuine engagement response to the card_variant_view experiment exposure.",
  },
  contact_click: {
    kind: "click",
    note: "A real click on a contact method (email, social link) - the portfolio's main conversion action.",
  },
  cv_download: {
    kind: "download",
    note: "A real CV file download - a genuine conversion action.",
  },
};

/**
 * Renders the semantics block for the insights prompt: one line per KNOWN
 * event name that actually appears in the data (nothing for events absent
 * from the data, nothing for unknown names beyond the generic fallback the
 * caller appends). The fallback keeps unknown events interpretable without
 * inventing meaning for them.
 */
export function renderEventSemantics(eventNames: string[]): string | null {
  const known = [...new Set(eventNames)].filter((name) => EVENT_SEMANTICS[name]).sort();
  if (known.length === 0) return null;
  const lines = known.map((name) => {
    const s = EVENT_SEMANTICS[name];
    const pairing = s.pairsWith ? ` Pairs with ${s.pairsWith.join(" / ")} (their count over this one is the click-through rate).` : "";
    return `- ${name}: ${s.note}${pairing}`;
  });
  return lines.join("\n");
}

/** Semantic lookup for eval validators and signal builders. */
export function getEventSemantics(name: string): EventSemantics | undefined {
  return EVENT_SEMANTICS[name];
}
