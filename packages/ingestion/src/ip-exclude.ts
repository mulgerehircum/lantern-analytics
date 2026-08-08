import { isIP } from "node:net";

/**
 * Server-side self-exclusion: drop events whose source IP (or CIDR range)
 * matches the EXCLUDED_IPS list before anything is persisted. Complements the
 * client-side `lantern_ignore` flag for traffic the flag can't cover (curl,
 * scripts, bots from a fixed egress IP).
 *
 * Zero dependencies by design: `node:net`'s `isIP` validates/classifies, and
 * the actual matching is BigInt masking with the version kept separate (v4 in
 * 32-bit space, v6 in 128-bit) so a /24 can't accidentally span the v4-mapped
 * v6 prefix. Malformed entries fail open — a bad exclusion must never start
 * silently dropping real visitors.
 */

const MASK128 = (1n << 128n) - 1n;

export interface ExcludedIpEntry {
  version: 4 | 6;
  value: bigint;
  prefixLen: number | null;
}

interface ParsedIp {
  version: 4 | 6;
  value: bigint;
}

/**
 * Splits a comma/whitespace-separated list of IPs and CIDRs (e.g.
 * "1.2.3.4, 192.168.0.0/24, 2001:db8::/64") into pre-parsed entries.
 * Anything unparseable is dropped — see the fail-open note above.
 */
export function parseExcludedIps(raw: string | undefined): ExcludedIpEntry[] {
  if (!raw) return [];

  const entries: ExcludedIpEntry[] = [];
  for (const token of raw.split(/[\s,]+/)) {
    if (!token) continue;
    const entry = parseEntry(token);
    if (entry) entries.push(entry);
  }
  return entries;
}

function parseEntry(token: string): ExcludedIpEntry | null {
  const slash = token.indexOf("/");
  if (slash === -1) {
    const ip = parseIp(token);
    if (!ip) return null;
    return { version: ip.version, value: ip.value, prefixLen: null };
  }

  const network = parseIp(token.slice(0, slash));
  if (!network) return null;

  const prefixLen = Number.parseInt(token.slice(slash + 1), 10);
  const maxBits = network.version === 4 ? 32 : 128;
  if (!/^\d+$/.test(token.slice(slash + 1)) || prefixLen < 0 || prefixLen > maxBits) {
    return null;
  }

  return { version: network.version, value: network.value, prefixLen };
}

function parseIp(ip: string): ParsedIp | null {
  const version = isIP(ip);
  if (version === 0) return null;

  if (version === 4) {
    const value = ip
      .split(".")
      .map(Number)
      .reduce((acc, n) => (acc << 8n) | BigInt(n), 0n);
    return { version: 4, value };
  }

  const value = parseIpv6(ip);
  if (value === null) return null;
  return { version: 6, value };
}

function parseIpv6(ip: string): bigint | null {
  const [left, right] = ip.split("::");
  const leftGroups = left ? left.split(":") : [];
  const rightGroups = right ? right.split(":") : [];
  const missing = 8 - leftGroups.length - rightGroups.length;
  if (missing < 0) return null;

  return groupsToBigInt([...leftGroups, ...Array<string>(missing).fill("0"), ...rightGroups]);
}

function groupsToBigInt(groups: string[]): bigint | null {
  if (groups.length !== 8) return null;

  let result = 0n;
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    result = (result << 16n) | BigInt(`0x${group}`);
  }
  return result;
}

/**
 * Returns true when `ip` matches an entry (exact IP or within a CIDR).
 * Unparseable/undefined IPs return false — we never want to start excluding
 * everyone because the input was bad.
 */
export function isIpExcluded(ip: string | undefined, entries: ExcludedIpEntry[]): boolean {
  if (!ip) return false;
  const parsed = parseIp(ip);
  if (!parsed) return false;

  for (const entry of entries) {
    if (entry.version !== parsed.version) continue;

    if (entry.prefixLen === null) {
      if (entry.value === parsed.value) return true;
      continue;
    }

    const maxBits = entry.version === 4 ? 32 : 128;
    const mask = MASK128 ^ ((1n << BigInt(maxBits - entry.prefixLen)) - 1n);
    if ((parsed.value & mask) === entry.value) return true;
  }
  return false;
}
