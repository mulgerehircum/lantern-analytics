import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { getInsights, INSIGHTS_SYSTEM_PROMPT, buildInsightsPrompt } from "../../src/lib/ai-query";
import { validateInsights } from "./validators";
import { bootstrapEvalInputs, loadFixtures, readCachedResponse, writeCachedResponse, cacheKeyPrompt, sleep, THROTTLE_MS, readGolden, writeGolden } from "./bootstrap";

/**
 * The insights eval harness. Gated on GEMINI_EVAL=1 because it makes real
 * (throttled, locally cached) Gemini calls; without the env var every test
 * here skips, leaving the normal CI suite untouched:
 *
 *   GEMINI_EVAL=1 npm run eval:insights
 *
 * What each fixture asserts (see validators.ts for the rules):
 * - structure/groundedness/anti-restatement/semantics/action/injection.
 * The quiet-site fixture only checks the validators handle emptiness.
 * Golden snapshots are written/compared alongside - update with
 * GOLDEN_UPDATE=1 to review prompt-change diffs.
 */

const RUN_EVAL = process.env.GEMINI_EVAL === "1";
const UPDATE_GOLDENS = process.env.GOLDEN_UPDATE === "1";
const FIXTURES_DIR = path.resolve(import.meta.dirname, "fixtures");

/**
 * Fixtures that document KNOWN current model failures (verified against
 * gemini-3.5-flash-lite): on thin data the model fills insight slots with
 * table restatements despite the hard rules. They fail the anti-restatement
 * validator today; the eval reports that as expected, not as a regression.
 * If a prompt/model change makes one pass, remove it from this set - that
 * IS the improvement the harness exists to catch. (synthetic-adversarial
 * was promoted out of this set when the engaged-session bounce
 * redefinition gave the model real session stats to cite instead.)
 */
const EXPECTED_FAILING: Record<string, string[]> = {
  "synthetic-hollow-dimension": ["anti-restatement"],
  "synthetic-thin-counts": ["anti-restatement"],
};

describe.skipIf(!RUN_EVAL)("AI insights eval (real Gemini calls)", () => {
  it(
    "fixtures produce insights that pass all validators",
    async () => {
      const cases = await loadFixtures(FIXTURES_DIR);
      expect(cases.length).toBeGreaterThan(0);

      const failuresByFixture: Record<string, string[]> = {};
      const unexpectedPasses: string[] = [];
      let firstCacheMiss = true;

      for (const { name, fixture } of cases) {
        const { summary, sessionsSummary, context } = bootstrapEvalInputs(fixture);

        // Quiet fixtures have nothing to say - production skips the call
        // (page.tsx gates on totalPageviews > 0); assert that contract.
        if (summary.totalPageviews === 0) {
          failuresByFixture[name] = [];
          continue;
        }

        // Real call, but cached locally per (prompt, fixture) so re-runs
        // don't re-burn quota.
        const prompt = buildInsightsPrompt(summary, sessionsSummary, context);
        const cacheFile = await cacheKeyPrompt(name, prompt, INSIGHTS_SYSTEM_PROMPT);
        let result = (await readCachedResponse(cacheFile)) as Awaited<ReturnType<typeof getInsights>> | null;
        if (!result) {
          if (!firstCacheMiss) await sleep(THROTTLE_MS);
          firstCacheMiss = false;
          result = await getInsights(summary, sessionsSummary, context);
          await writeCachedResponse(cacheFile, result);
        }

        const validationInput = {
          insights: result.insights,
          summary,
          sessionsSummary,
          signals: context.signals,
        };
        const failures = validateInsights(validationInput);
        const expectedRules = EXPECTED_FAILING[name] ?? [];
        const unexpected = failures.filter((f) => !expectedRules.includes(f.rule));

        // Known-failing fixture now passing = prompt/model improved; surface it.
        if (expectedRules.length > 0 && unexpected.length === failures.length && failures.length === 0) {
          unexpectedPasses.push(`${name} now PASSES - remove from EXPECTED_FAILING`);
        }
        failuresByFixture[name] = unexpected.map((f) => `${f.rule}: ${f.message}`);
        for (const expected of failures.filter((f) => expectedRules.includes(f.rule))) {
          console.log(`  KNOWN  ${name}: ${expected.rule}: ${expected.message}`);
        }

        // Golden snapshot: record or diff (advisory, not a gate).
        const golden = await readGolden(name);
        if (UPDATE_GOLDENS || !golden) {
          await writeGolden(name, result.insights);
        } else if (JSON.stringify(golden) !== JSON.stringify(result.insights)) {
          failuresByFixture[name].push(
            `golden-diff (advisory): output changed vs committed golden - review with GOLDEN_UPDATE=1 if intended`,
          );
        }
      }

      const hardFailures = Object.entries(failuresByFixture).filter(
        ([, messages]) => messages.filter((m) => !m.startsWith("golden-diff")).length > 0,
      );

      // Per-fixture report for the console, then a single hard assertion so
      // the vitest output shows every failing fixture at once.
      for (const [name, messages] of Object.entries(failuresByFixture)) {
        if (messages.length === 0) {
          console.log(`  PASS  ${name}`);
        } else {
          for (const message of messages) console.log(`  FAIL  ${name}: ${message}`);
        }
      }
      for (const pass of unexpectedPasses) console.log(`  IMPROVED  ${pass}`);
      expect(hardFailures, "see per-fixture failures above").toEqual([]);
      expect(unexpectedPasses, "expected-failing fixtures now pass - promote them").toEqual([]);
    },
    120_000 * 6,
  );

  it("documents the harness (always-on smoke check of fixture integrity)", () => {
    // Runs even without GEMINI_EVAL only if fixtures exist - keeps the
    // normal suite green in any environment.
    if (!existsSync(path.join(FIXTURES_DIR, "andrii-portfolio.json"))) {
      console.log("  (fixtures not present - skipping integrity check)");
      return;
    }
    const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json")).sort();
    const cases = files.map((file) => ({
      name: JSON.parse(readFileSync(path.join(FIXTURES_DIR, file), "utf8")).siteId,
      fixture: JSON.parse(readFileSync(path.join(FIXTURES_DIR, file), "utf8")),
    }));
    for (const { name, fixture } of cases) {
      expect(fixture.items, `${name}: missing items`).toBeTruthy();
      expect(Array.isArray(fixture.items.rollups), `${name}: rollups must be an array`).toBe(true);
    }
    const real = cases.find((c) => c.name === "andrii-portfolio");
    expect(real, "real portfolio fixture must exist").toBeTruthy();
    expect(real!.fixture.items.rollups.length).toBeGreaterThan(0);
  });
});
