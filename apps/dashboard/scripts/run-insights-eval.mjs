// npm-script wrapper for the insights eval: sets GEMINI_EVAL=1 (the gate
// the eval file checks) and hands off to vitest. Exists because npm scripts
// can't set env vars cross-platform without a dependency like cross-env.
//
// Usage: npm run eval:insights           (validators + goldens vs cache)
//        GOLDEN_UPDATE=1 npm run ...     is NOT needed via this wrapper -
//        pass --update to set both:      npm run eval:insights -- --update

import { spawnSync } from "node:child_process";

const env = { ...process.env, GEMINI_EVAL: "1" };
if (process.argv.includes("--update")) env.GOLDEN_UPDATE = "1";

const vitest = spawnSync("npx", ["vitest", "run", "eval/insights/insights.test.ts"], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});
process.exit(vitest.status ?? 1);
