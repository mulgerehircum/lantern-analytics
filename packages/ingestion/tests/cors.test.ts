import { describe, it, expect } from "vitest";
import { corsHeaders } from "../src/cors";

describe("corsHeaders", () => {
  it("reflects the actual origin rather than a literal wildcard", () => {
    const headers = corsHeaders("https://andriiponomarenko.vercel.app");
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://andriiponomarenko.vercel.app");
  });

  it("always sets Allow-Credentials: true, required for sendBeacon's forced credentials mode", () => {
    expect(corsHeaders("https://example.com")["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("falls back to a wildcard when there is no Origin header (e.g. a non-browser request)", () => {
    expect(corsHeaders(undefined)["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("sets Vary: Origin since the response depends on the request's origin", () => {
    expect(corsHeaders("https://example.com")["Vary"]).toBe("Origin");
  });
});
