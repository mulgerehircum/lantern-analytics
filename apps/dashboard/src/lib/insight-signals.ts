import type { DashboardSummary } from "./summarize";
import type { HourlyRollupItem } from "./dynamodb";
import { getEventSemantics } from "./event-semantics";

/**
 * Precomputed comparison signals for the AI insights layer. Root cause this
 * fixes: getInsights used to see only current-period absolutes, so the
 * cheapest "insight" was restating the top row of a table the owner can
 * already read (top referrer, top device, ...). Deltas and paired-event
 * ratios give the model relations to say instead.
 *
 * Everything here is PURE - derived from the summaries the dashboard
 * already computes, no extra I/O - so it's unit-testable and shared
 * verbatim between the production prompt and the eval harness bootstrap.
 */

export interface DimensionDelta {
  key: string;
  current: number;
  previous: number;
  /** Percent change, 1 decimal. null when previous is 0 ("new", not Infinity). */
  deltaPercent: number | null;
}

export interface RatioSignal {
  /** Human-readable label, e.g. "card_variant_view CTR". */
  label: string;
  numerator: number;
  denominator: number;
  /** numerator/denominator as a percentage, 1 decimal. null when denominator is 0. */
  percent: number | null;
}

export interface InsightSignals {
  /**
   * What current/previous summarize: "period-over-period" when a period is
   * selected; "trailing-30d" (trailing 30d vs prior 30d) or
   * "history-halves" (recent half of history vs older half - young sites
   * have no full prior-30d window) for the all-time view; null when no
   * comparison is possible (ratios only). See splitComparisonWindows.
   */
  comparisonBasis: "period-over-period" | "trailing-30d" | "history-halves" | null;
  pageviewsDeltaPercent: number | null;
  uniquesDeltaPercent: number | null;
  /** Per-dimension deltas for the slices big enough to matter (see MIN_DELTA_COUNT). */
  referrerDeltas: DimensionDelta[];
  countryDeltas: DimensionDelta[];
  deviceDeltas: DimensionDelta[];
  pageDeltas: DimensionDelta[];
  eventDeltas: DimensionDelta[];
  /** Paired-event ratios from the semantics registry, e.g. experiment CTR, contact rate. */
  ratios: RatioSignal[];
}

/** Below this total count a dimension slice is noise; delta-ing it produces fake "insight". */
const MIN_DELTA_COUNT = 5;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Percent change from previous to current, 1 decimal; null (not Infinity) when previous is 0. */
function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function diffDimension<K extends string>(
  current: Array<Record<K, string> & { count: number }>,
  previous: Array<Record<K, string> & { count: number }>,
  keyName: K,
): DimensionDelta[] {
  const previousByKey = new Map(previous.map((row) => [row[keyName], row.count]));
  const deltas: DimensionDelta[] = [];
  for (const row of current) {
    const prev = previousByKey.get(row[keyName]) ?? 0;
    // "New" slices (prev 0) stay in - they're real signal - but only once
    // they clear the noise floor. Slices present in both need no floor:
    // a -80% collapse on a previously-real source is interesting at any size.
    if (prev === 0 && row.count < MIN_DELTA_COUNT) continue;
    deltas.push({ key: row[keyName], current: row.count, previous: prev, deltaPercent: deltaPercent(row.count, prev) });
  }
  // "Gone" slices (previous > 0, current 0) - a source that stopped
  // sending traffic is real signal too. Same noise floor as new slices.
  const currentKeys = new Set(current.map((row) => row[keyName]));
  for (const row of previous) {
    if (currentKeys.has(row[keyName])) continue;
    if (row.count < MIN_DELTA_COUNT) continue;
    deltas.push({ key: row[keyName], current: 0, previous: row.count, deltaPercent: -100 });
  }
  return deltas.sort((a, b) => Math.abs(b.deltaPercent ?? Infinity) - Math.abs(a.deltaPercent ?? Infinity));
}

function pairedRatios(summary: DashboardSummary): RatioSignal[] {
  const eventCount = (name: string) => summary.customEvents.find((e) => e.name === name)?.count ?? 0;
  const ratios: RatioSignal[] = [];

  // Experiment CTRs from the semantics registry: every impression-kind
  // event with declared click pairings yields one CTR line.
  for (const event of summary.customEvents) {
    const semantics = getEventSemantics(event.name);
    if (!semantics?.pairsWith || semantics.pairsWith.length === 0) continue;
    const numerator = semantics.pairsWith.reduce((sum, click) => sum + eventCount(click), 0);
    ratios.push({
      label: `${event.name} click-through rate (${semantics.pairsWith.join(" + ")} / ${event.name})`,
      numerator,
      denominator: event.count,
      percent: event.count > 0 ? Math.round((numerator / event.count) * 1000) / 10 : null,
    });
  }
  // Contact/download conversion rate: real actions per pageview.
  for (const name of ["contact_click", "cv_download"]) {
    const count = eventCount(name);
    if (count === 0) continue;
    ratios.push({
      label: `${name} rate (${name} / pageviews)`,
      numerator: count,
      denominator: summary.totalPageviews,
      percent: summary.totalPageviews > 0 ? Math.round((count / summary.totalPageviews) * 1000) / 10 : null,
    });
  }
  return ratios;
}

/**
 * Compares two summaries. `current` is the view being rendered; `previous`
 * is the immediately-preceding equivalent window (same period last cycle,
 * or the mirrored window splitComparisonWindows produces for the all-time view).
 * Ratios always compute (they need only `current`), which is why the
 * filtered view still gets signal: its "previous" isn't filter-scoped, so
 * callers pass undefined there and get ratios-only.
 */
export function buildInsightSignals(
  current: DashboardSummary,
  previous: DashboardSummary | undefined,
  basis: InsightSignals["comparisonBasis"] = "period-over-period",
): InsightSignals {
  const ratios = pairedRatios(current);
  if (!previous) {
    return {
      comparisonBasis: null,
      pageviewsDeltaPercent: null,
      uniquesDeltaPercent: null,
      referrerDeltas: [],
      countryDeltas: [],
      deviceDeltas: [],
      pageDeltas: [],
      eventDeltas: [],
      ratios,
    };
  }
  return {
    comparisonBasis: basis,
    pageviewsDeltaPercent: deltaPercent(current.totalPageviews, previous.totalPageviews),
    uniquesDeltaPercent: deltaPercent(current.totalUniques, previous.totalUniques),
    referrerDeltas: diffDimension(current.referrers, previous.referrers, "referrer"),
    countryDeltas: diffDimension(current.countries, previous.countries, "country"),
    deviceDeltas: diffDimension(current.devices, previous.devices, "device"),
    pageDeltas: diffDimension(current.topPages, previous.topPages, "path"),
    eventDeltas: diffDimension(current.customEvents, previous.customEvents, "name"),
    ratios,
  };
}

/**
 * Splits all-time rollups into two comparable windows, for the all-time view
 * (which has no natural "previous period"). Adaptive:
 *
 * 1. With a full mirrored prior window available - history reaching back at
 *    least 2 x `days` AND enough data in the prior window (see
 *    MIN_PRIOR_HOURS below) - trailing `days` vs the `days` before that
 *    ("trailing-30d"). Rollups older than the mirrored window are ignored
 *    - older history doesn't change what the last 60 days compare like.
 * 2. Otherwise, with at least MIN_HALVES_SPAN_MS of total span: history
 *    split at its time midpoint into a recent half and an older half
 *    ("history-halves"). A young site with, say, 28d of history gets
 *    14d-vs-14d - symmetric where 30d-vs-partial would be lopsided, and
 *    never empty where a fixed prior-30d window would be (a site younger
 *    than 30d has NO prior window at all, which left the model with
 *    null-only deltas and nothing to say but table tops - the failure that
 *    motivated this).
 * 3. Less than 3d total span or no rollups: no windows (both empty) -
 *    there isn't enough distance in time for a meaningful comparison.
 *
 * The trailing window intentionally includes the live current hour's
 * pseudo-rollup the caller appends; future/unparseable SKs are dropped.
 */
export function splitComparisonWindows(
  rollups: HourlyRollupItem[],
  days: number = 30,
  now: Date = new Date(),
): { current: HourlyRollupItem[]; previous: HourlyRollupItem[]; basis: "trailing-30d" | "history-halves" | null } {
  const hourStart = (r: HourlyRollupItem): number | null => {
    // "AGG#2026-08-15#14" -> "2026-08-15T14:00:00.000Z" (hour start, UTC).
    const iso = `${r.SK.replace("AGG#", "").replace("#", "T")}:00:00.000Z`;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? null : t;
  };
  const withTimes = rollups
    .map((r) => ({ r, t: hourStart(r) }))
    .filter((x): x is { r: HourlyRollupItem; t: number } => x.t !== null && x.t <= now.getTime());

  if (withTimes.length === 0) {
    return { current: [], previous: [], basis: null };
  }

  const earliest = Math.min(...withTimes.map((x) => x.t));
  const latest = Math.max(...withTimes.map((x) => x.t));
  const spanMs = latest - earliest;
  const nowMs = now.getTime();
  const currentStart = nowMs - days * MS_PER_DAY;
  const priorStart = nowMs - 2 * days * MS_PER_DAY;

  // Case 1: the mirrored prior window is fully spanned by history and
  // actually populated. Both matter: history reaching past priorStart alone
  // isn't enough if the prior window itself is a dark gap (comparing 30
  // days against nothing yields all-null deltas), and a lone stray hour in
  // it (site ~31 days old) isn't a comparison either - 30 days vs 1 hour is
  // lopsided. The hours threshold is density-relative so a genuinely quiet
  // site (1 eventful hour/day) still qualifies with its real prior window.
  const priorHours = new Set(withTimes.filter((x) => x.t >= priorStart && x.t < currentStart).map((x) => x.t));
  const currentHours = new Set(withTimes.filter((x) => x.t >= currentStart).map((x) => x.t));
  const minPriorHours = Math.max(2, Math.ceil(currentHours.size / 10));
  if (earliest <= priorStart && priorHours.size >= minPriorHours) {
    const current = withTimes.filter((x) => x.t >= currentStart).map((x) => x.r);
    const previous = withTimes.filter((x) => x.t >= priorStart && x.t < currentStart).map((x) => x.r);
    return { current, previous, basis: "trailing-30d" };
  }

  // Case 2: young history - split what exists at its midpoint.
  if (spanMs >= MIN_HALVES_SPAN_MS) {
    const midpoint = earliest + spanMs / 2;
    const current = withTimes.filter((x) => x.t >= midpoint).map((x) => x.r);
    const previous = withTimes.filter((x) => x.t < midpoint).map((x) => x.r);
    return { current, previous, basis: "history-halves" };
  }

  // Case 3: too little time distance to compare anything.
  return { current: [], previous: [], basis: null };
}

/** Below this total history span the halves split is meaningless noise. */
const MIN_HALVES_SPAN_MS = 3 * MS_PER_DAY;
