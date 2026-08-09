import { describe, it, expect } from "vitest";
import { SITES, DEFAULT_SITE_ID, getSite } from "../src/lib/sites";

describe("site registry", () => {
  it("has unique siteIds", () => {
    const ids = SITES.map((s) => s.siteId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a name and a non-empty siteId on every entry", () => {
    for (const site of SITES) {
      expect(site.siteId.length).toBeGreaterThan(0);
      expect(site.name.length).toBeGreaterThan(0);
    }
  });

  it("includes the default site", () => {
    expect(getSite(DEFAULT_SITE_ID)).toBeDefined();
  });

  it("includes every deployed tracker siteId", () => {
    const ids = new Set(SITES.map((s) => s.siteId));
    for (const id of [
      "andrii-portfolio",
      "ukraine-warmap",
      "dataroom-technical-assessment",
      "noire-winery-landing-v1",
      "pdfloom-frontend",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("returns undefined for an unknown siteId", () => {
    expect(getSite("nope")).toBeUndefined();
  });
});
