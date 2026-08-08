import { describe, it, expect } from "vitest";
import { resolveCountry } from "../src/geo";

describe("resolveCountry", () => {
  it("returns the header value uppercased", () => {
    expect(resolveCountry("md")).toBe("MD");
  });

  it("falls back to unknown when the header is undefined", () => {
    expect(resolveCountry(undefined)).toBe("unknown");
  });

  it("falls back to unknown when the header is empty or whitespace", () => {
    expect(resolveCountry("")).toBe("unknown");
    expect(resolveCountry("   ")).toBe("unknown");
  });

  it("trims surrounding whitespace", () => {
    expect(resolveCountry("  PL  ")).toBe("PL");
  });
});
