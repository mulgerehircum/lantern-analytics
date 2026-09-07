import { describe, it, expect } from "vitest";
import { REFERRER_SEMANTICS, renderReferrerSemantics, getReferrerSemantics } from "../src/lib/referrer-semantics";

describe("referrer-semantics registry", () => {
  it("documents portfolios.anav.dev as a static-list proxy with no owner", () => {
    const entry = REFERRER_SEMANTICS["portfolios.anav.dev"];
    expect(entry).toBeDefined();
    expect(entry.kind).toBe("static-list-proxy");
    expect(entry.note).toContain("developer-portfolios");
    expect(entry.note).toContain("no owner to contact");
  });

  it("renders only hostnames present in the data", () => {
    const rendered = renderReferrerSemantics(["github.com", "portfolios.anav.dev", "direct"]);
    expect(rendered).toContain("- portfolios.anav.dev:");
    expect(rendered).not.toContain("- github.com:");
  });

  it("returns null when no known hostnames appear", () => {
    expect(renderReferrerSemantics(["github.com", "direct", "bing.com"])).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(renderReferrerSemantics([])).toBeNull();
  });

  it("deduplicates repeated hostnames", () => {
    const rendered = renderReferrerSemantics(["portfolios.anav.dev", "portfolios.anav.dev"]);
    expect(rendered).not.toBeNull();
    expect(rendered!.split("\n").length).toBe(1);
  });

  it("looks up entries for validators", () => {
    expect(getReferrerSemantics("portfolios.anav.dev")?.kind).toBe("static-list-proxy");
    expect(getReferrerSemantics("github.com")).toBeUndefined();
  });
});
