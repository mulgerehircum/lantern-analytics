import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { summarizeRollups, summarizeSessions } from "../../src/lib/summarize";
import { buildInsightSignals, splitComparisonWindows } from "../../src/lib/insight-signals";
import type { HourlyRollupItem } from "../../src/lib/dynamodb";
import type { SessionRecordingItem } from "../../src/lib/sessions";
import type { InsightsContext } from "../../src/lib/ai-query";

/**
 * Turns a dumped fixture ({ items: { rollups, liveEvents, sessions } }) into
 * exactly what the production Overview page feeds getInsights - via the
 * SAME pure functions the page uses. This is the whole point of storing raw
 * items rather than precomputed summaries: the eval exercises production.
 */

export interface FixtureFile {
  siteId: string;
  dumpedAt: string;
  source: string;
  items: {
    rollups: HourlyRollupItem[];
    liveEvents: Array<Record<string, unknown>>;
    sessions: SessionRecordingItem[];
  };
}

export interface FixtureCase {
  name: string;
  fixture: FixtureFile;
}

export async function loadFixtures(fixturesDir: string): Promise<FixtureCase[]> {
  const files = (await readdir(fixturesDir)).filter((f) => f.endsWith(".json")).sort();
  const cases: FixtureCase[] = [];
  for (const file of files) {
    const fixture = JSON.parse(await readFile(path.join(fixturesDir, file), "utf8")) as FixtureFile;
    cases.push({ name: fixture.siteId, fixture });
  }
  return cases;
}

export interface EvalInputs {
  summary: ReturnType<typeof summarizeRollups>;
  sessionsSummary: ReturnType<typeof summarizeSessions>;
  context: InsightsContext;
}

/** Mirrors page.tsx's unfiltered all-time branch: adaptive comparison windows. */
export function bootstrapEvalInputs(fixture: FixtureFile): EvalInputs {
  const summary = summarizeRollups(fixture.items.rollups);
  const sessionsSummary = summarizeSessions(fixture.items.sessions);
  const recent = splitComparisonWindows(fixture.items.rollups, 30, new Date(fixture.dumpedAt));
  const context: InsightsContext = {
    eventNames: summary.customEvents.map((e) => e.name),
    referrers: summary.referrers.map((r) => r.referrer),
    signals: buildInsightSignals(
      summarizeRollups(recent.current),
      summarizeRollups(recent.previous),
      recent.basis ?? undefined,
    ),
  };
  return { summary, sessionsSummary, context };
}

// ---------------------------------------------------------------------------
// Local response cache: re-runs of the eval must not burn Gemini's free-tier
// 5 req/min quota. Keyed on the full prompt content + fixture name, so any
// prompt/fixture change is a natural cache miss; the cache dir is gitignored.
// ---------------------------------------------------------------------------

const CACHE_DIR = path.resolve(import.meta.dirname, ".cache");

export async function cacheKeyPrompt(name: string, prompt: string, systemPrompt: string): Promise<string> {
  const hash = createHash("sha256").update(`${systemPrompt}\n---\n${prompt}`).digest("hex").slice(0, 24);
  return `${name}-${hash}.json`;
}

export async function readCachedResponse(cacheFile: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path.join(CACHE_DIR, cacheFile), "utf8"));
  } catch {
    return null;
  }
}

export async function writeCachedResponse(cacheFile: string, response: unknown): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path.join(CACHE_DIR, cacheFile), JSON.stringify(response, null, 2) + "\n");
}

/** Single-flight-ish throttle: spacing calls keeps the eval inside free-tier RPM. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const THROTTLE_MS = 10_000;

// ---------------------------------------------------------------------------
// Golden snapshots: committed expected outputs. GOLDEN_UPDATE=1 rewrites
// them; otherwise a diff vs the live response is reported (not fatal - the
// validators are the gate, the golden shows you what changed).
// ---------------------------------------------------------------------------

const GOLDENS_DIR = path.resolve(import.meta.dirname, "goldens");

export async function readGolden(name: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path.join(GOLDENS_DIR, `${name}.json`), "utf8"));
  } catch {
    return null;
  }
}

export async function writeGolden(name: string, insights: unknown): Promise<void> {
  await mkdir(GOLDENS_DIR, { recursive: true });
  await writeFile(path.join(GOLDENS_DIR, `${name}.json`), JSON.stringify(insights, null, 2) + "\n");
}
