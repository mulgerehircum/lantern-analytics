import type { RawEventRecordWithKey } from "./dynamodb";
import type { SessionRecordingItem } from "./sessions";
import { findCustomEventsForSession, DEFAULT_MATCH_TOLERANCE_MS } from "./session-correlation";

/**
 * Summarizes the portfolio's live-iframe-vs-video card experiment (see
 * my-portfolio's utils/experiment.ts) from raw events. Rollups can't answer
 * this — eventDimensions flattens project_title and variant into separate
 * per-key breakdowns, losing the join between "this impression/click was for
 * project X under variant Y" — so this reads card_variant_view (impression),
 * project_link_click (click), and iframe_expand_click (iframe-variant modal
 * open) EVENT# items directly. Same ~30-day raw-event TTL coverage limit as
 * the dashboard's dimension filters.
 */

export interface ExperimentVariantStats {
  variant: string;
  impressions: number;
  liveClicks: number;
  githubClicks: number;
  /** Clicks that opened the live-site iframe modal (iframe variant only — see trackIframeExpand). */
  expandClicks: number;
  /** liveClicks / impressions, as a percentage rounded to 1 decimal. */
  ctrPercent: number;
  /**
   * (liveClicks + expandClicks) / impressions, as a percentage rounded to 1
   * decimal. Broader than ctrPercent: counts expanding the live-site iframe
   * modal as engagement alongside clicking through via the Link anchor, so
   * the iframe variant isn't penalized for offering an in-card way to engage
   * that the video variant doesn't have. GitHub clicks are excluded — that's
   * a click off the card unrelated to the live-site treatment being tested.
   */
  engagementPercent: number;
}

export interface ExperimentProjectStats {
  project: string;
  variants: ExperimentVariantStats[];
}

export interface ExperimentSummary {
  overall: ExperimentVariantStats[];
  byProject: ExperimentProjectStats[];
}

function buildStats(
  impressionsByVariant: Record<string, number>,
  liveClicksByVariant: Record<string, number>,
  githubClicksByVariant: Record<string, number>,
  expandClicksByVariant: Record<string, number>,
): ExperimentVariantStats[] {
  const variants = new Set([
    ...Object.keys(impressionsByVariant),
    ...Object.keys(liveClicksByVariant),
    ...Object.keys(githubClicksByVariant),
    ...Object.keys(expandClicksByVariant),
  ]);
  return [...variants]
    .map((variant) => {
      const impressions = impressionsByVariant[variant] ?? 0;
      const liveClicks = liveClicksByVariant[variant] ?? 0;
      const githubClicks = githubClicksByVariant[variant] ?? 0;
      const expandClicks = expandClicksByVariant[variant] ?? 0;
      return {
        variant,
        impressions,
        liveClicks,
        githubClicks,
        expandClicks,
        ctrPercent: impressions > 0 ? Math.round((liveClicks / impressions) * 1000) / 10 : 0,
        engagementPercent: impressions > 0 ? Math.round(((liveClicks + expandClicks) / impressions) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.impressions - a.impressions || a.variant.localeCompare(b.variant));
}

/** Reads card_variant_view / project_link_click / iframe_expand_click events; anything else (or missing a `variant`) is ignored. */
export function summarizeExperiment(events: RawEventRecordWithKey[]): ExperimentSummary {
  const overallImpressions: Record<string, number> = {};
  const overallLiveClicks: Record<string, number> = {};
  const overallGithubClicks: Record<string, number> = {};
  const overallExpandClicks: Record<string, number> = {};

  const byProjectImpressions: Record<string, Record<string, number>> = {};
  const byProjectLiveClicks: Record<string, Record<string, number>> = {};
  const byProjectGithubClicks: Record<string, Record<string, number>> = {};
  const byProjectExpandClicks: Record<string, Record<string, number>> = {};

  for (const event of events) {
    const metadata = event.metadata ?? {};
    const project = typeof metadata.project_title === "string" ? metadata.project_title : undefined;
    const variant = typeof metadata.variant === "string" ? metadata.variant : undefined;
    if (!variant) continue;

    if (event.name === "card_variant_view") {
      overallImpressions[variant] = (overallImpressions[variant] ?? 0) + 1;
      if (project) {
        const byVariant = (byProjectImpressions[project] ??= {});
        byVariant[variant] = (byVariant[variant] ?? 0) + 1;
      }
    } else if (event.name === "project_link_click") {
      const isGithub = metadata.link_type === "github";
      const overallTarget = isGithub ? overallGithubClicks : overallLiveClicks;
      overallTarget[variant] = (overallTarget[variant] ?? 0) + 1;
      if (project) {
        const byProjectTarget = isGithub ? byProjectGithubClicks : byProjectLiveClicks;
        const byVariant = (byProjectTarget[project] ??= {});
        byVariant[variant] = (byVariant[variant] ?? 0) + 1;
      }
    } else if (event.name === "iframe_expand_click") {
      overallExpandClicks[variant] = (overallExpandClicks[variant] ?? 0) + 1;
      if (project) {
        const byVariant = (byProjectExpandClicks[project] ??= {});
        byVariant[variant] = (byVariant[variant] ?? 0) + 1;
      }
    }
  }

  const projects = new Set([
    ...Object.keys(byProjectImpressions),
    ...Object.keys(byProjectLiveClicks),
    ...Object.keys(byProjectGithubClicks),
    ...Object.keys(byProjectExpandClicks),
  ]);

  return {
    overall: buildStats(overallImpressions, overallLiveClicks, overallGithubClicks, overallExpandClicks),
    byProject: [...projects].sort((a, b) => a.localeCompare(b)).map((project) => ({
      project,
      variants: buildStats(
        byProjectImpressions[project] ?? {},
        byProjectLiveClicks[project] ?? {},
        byProjectGithubClicks[project] ?? {},
        byProjectExpandClicks[project] ?? {},
      ),
    })),
  };
}

/**
 * Attaches each session's experiment variant (if any) by matching its
 * visitorHash against card_variant_view impressions that fall within the
 * session's time window (see lib/session-correlation.ts for the shared
 * matching logic — this is direction 1, session → its events, filtered down
 * to impressions and taking the earliest qualifying one). Sessions with no
 * matching impression (visitor never saw an experiment-eligible card,
 * session predates the experiment, or the raw event has already expired
 * past its TTL) get no `variant` field — distinct from a session that saw
 * the "video" variant, so callers can render "—" rather than mislabel it.
 */
export function attachVariantToSessions(
  sessions: SessionRecordingItem[],
  events: RawEventRecordWithKey[],
): Array<SessionRecordingItem & { variant?: string }> {
  const impressions = events.filter((e) => e.name === "card_variant_view" && typeof e.metadata?.variant === "string");

  return sessions.map((session) => {
    const match = findCustomEventsForSession(session, impressions, DEFAULT_MATCH_TOLERANCE_MS)[0];
    return match ? { ...session, variant: match.metadata!.variant as string } : session;
  });
}
