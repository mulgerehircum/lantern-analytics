// Downloads FlagCDN w20 (20px-wide) PNGs for every ISO 3166-1 alpha-2 country
// code into public/flags/ so the dashboard serves flags same-origin instead of
// hitting flagcdn.com at runtime. Flag images are tiny and rarely change;
// re-run manually when new codes appear (e.g. a country split).
//
// Usage: node scripts/fetch-flags.mjs
// Requires network access to flagcdn.com.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.resolve(import.meta.dirname, "../public/flags");
const CODES_URL = "https://flagcdn.com/en/codes.json";
const FLAG_URL = (code) => `https://flagcdn.com/w20/${code}.png`;

const res = await fetch(CODES_URL);
if (!res.ok) throw new Error(`codes.json fetch failed: ${res.status}`);
const codes = Object.keys(await res.json());

await mkdir(OUT_DIR, { recursive: true });

let fetched = 0;
const failures = [];
for (const code of codes) {
  const flag = await fetch(FLAG_URL(code));
  if (!flag.ok) {
    failures.push(`${code}: HTTP ${flag.status}`);
    continue;
  }
  await writeFile(path.join(OUT_DIR, `${code}.png`), Buffer.from(await flag.arrayBuffer()));
  fetched++;
}

console.log(`Fetched ${fetched}/${codes.length} flags into ${OUT_DIR}`);
if (failures.length > 0) {
  console.error("Failures:\n" + failures.join("\n"));
  process.exit(1);
}
