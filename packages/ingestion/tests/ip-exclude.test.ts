import { describe, it, expect } from "vitest";
import { isIpExcluded, parseExcludedIps } from "../src/ip-exclude";

describe("parseExcludedIps", () => {
  it("returns an empty list for undefined or empty input", () => {
    expect(parseExcludedIps(undefined)).toEqual([]);
    expect(parseExcludedIps("")).toEqual([]);
  });

  it("splits on commas and whitespace", () => {
    const entries = parseExcludedIps("1.2.3.4, 5.6.7.8\t10.0.0.0/8");
    expect(entries).toHaveLength(3);
  });

  it("drops malformed entries (fail open)", () => {
    const entries = parseExcludedIps("1.2.3.4, not-an-ip, 10.0.0.0/99, 10.0.0.0/24");
    expect(entries).toHaveLength(2);
  });
});

describe("isIpExcluded", () => {
  it("matches exact IPv4 addresses", () => {
    const entries = parseExcludedIps("1.2.3.4");
    expect(isIpExcluded("1.2.3.4", entries)).toBe(true);
    expect(isIpExcluded("1.2.3.5", entries)).toBe(false);
  });

  it("matches exact IPv6 addresses", () => {
    const entries = parseExcludedIps("2001:db8::1");
    expect(isIpExcluded("2001:db8::1", entries)).toBe(true);
    expect(isIpExcluded("2001:db8::2", entries)).toBe(false);
  });

  it("matches IPv4 CIDR ranges", () => {
    const entries = parseExcludedIps("192.168.0.0/24");
    expect(isIpExcluded("192.168.0.1", entries)).toBe(true);
    expect(isIpExcluded("192.168.255.1", entries)).toBe(false);
  });

  it("matches IPv6 CIDR ranges", () => {
    const entries = parseExcludedIps("2001:db8::/64");
    expect(isIpExcluded("2001:db8::1234:5678", entries)).toBe(true);
    expect(isIpExcluded("2001:db9::1", entries)).toBe(false);
  });

  it("a /32 CIDR behaves like an exact IPv4 match", () => {
    const entries = parseExcludedIps("10.0.0.0/32");
    expect(isIpExcluded("10.0.0.0", entries)).toBe(true);
    expect(isIpExcluded("10.0.0.1", entries)).toBe(false);
  });

  it("IPv4 entries never match IPv6 addresses (and vice versa)", () => {
    const v4 = parseExcludedIps("1.2.3.4");
    const v6 = parseExcludedIps("2001:db8::1");
    expect(isIpExcluded("2001:db8::1", v4)).toBe(false);
    expect(isIpExcluded("1.2.3.4", v6)).toBe(false);
  });

  it("fails open on unparseable or missing IPs", () => {
    const entries = parseExcludedIps("1.2.3.4");
    expect(isIpExcluded("not-an-ip", entries)).toBe(false);
    expect(isIpExcluded(undefined, entries)).toBe(false);
  });
});
