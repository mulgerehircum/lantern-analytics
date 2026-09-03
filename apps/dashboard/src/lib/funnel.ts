import type { RawEventRecordWithKey } from "./dynamodb";
import { matchesFilter } from "./filter";
import { parseEventTimestamp } from "./session-correlation";

export interface FunnelStep {
  type: "path" | "event";
  value: string;
}

export interface FunnelStepResult {
  step: FunnelStep;
  visitorCount: number;
  /** Percentage (0-100, 1 decimal) of step 0's visitor count. */
  conversionFromStartPercent: number;
  /** Percentage (0-100, 1 decimal) of the previous step's visitor count. 100 for step 0. */
  conversionFromPreviousPercent: number;
}

function stepMatches(event: RawEventRecordWithKey, step: FunnelStep): boolean {
  return step.type === "path" ? matchesFilter(event, { path: step.value }) : matchesFilter(event, { eventName: step.value });
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

/**
 * Per-visitor, in-order step matching over raw events (bounded by the
 * ~30-day raw-event TTL, same as every other raw-event-driven view in this
 * app - see lib/filter.ts's doc comment). Step matching reuses matchesFilter
 * rather than a bespoke predicate, since a funnel step is just a
 * single-dimension filter.
 *
 * Deliberately not time-boxed between steps: a visitor who does step 1 today
 * and step 2 next week still counts, as long as the order holds. At this
 * site's traffic volume a stricter "must convert within N minutes" window
 * wasn't asked for and would just be unverifiable complexity.
 */
export function computeFunnel(events: RawEventRecordWithKey[], steps: FunnelStep[]): FunnelStepResult[] {
  if (steps.length === 0) return [];

  const byVisitor = new Map<string, RawEventRecordWithKey[]>();
  for (const event of events) {
    if (!event.visitorHash) continue;
    const list = byVisitor.get(event.visitorHash);
    if (list) list.push(event);
    else byVisitor.set(event.visitorHash, [event]);
  }
  for (const list of byVisitor.values()) {
    list.sort((a, b) => (parseEventTimestamp(a.SK) ?? 0) - (parseEventTimestamp(b.SK) ?? 0));
  }

  const stepCounts = new Array(steps.length).fill(0) as number[];
  for (const visitorEvents of byVisitor.values()) {
    let sinceMs = -Infinity;
    let reached = 0;
    for (const step of steps) {
      const match = visitorEvents.find((e) => (parseEventTimestamp(e.SK) ?? -Infinity) >= sinceMs && stepMatches(e, step));
      if (!match) break;
      reached += 1;
      sinceMs = parseEventTimestamp(match.SK) ?? sinceMs;
    }
    for (let i = 0; i < reached; i++) stepCounts[i] += 1;
  }

  const startCount = stepCounts[0] ?? 0;
  return steps.map((step, i) => ({
    step,
    visitorCount: stepCounts[i],
    conversionFromStartPercent: percent(stepCounts[i], startCount),
    conversionFromPreviousPercent: i === 0 ? 100 : percent(stepCounts[i], stepCounts[i - 1]),
  }));
}
