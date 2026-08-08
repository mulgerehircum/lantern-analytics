/**
 * Self-exclusion opt-out: an explicit, owner-set localStorage flag that makes
 * the tracker no-op. This is the one deliberate exception to the script's
 * "no localStorage" rule — it is a user-set preference, never written for
 * visitors, and contains no identity.
 *
 * localStorage access is wrapped because it can throw (blocked storage,
 * private modes) — an opt-out check must never error the host page.
 */
const IGNORE_KEY = "lantern_ignore";

export function isIgnored(): boolean {
  try {
    return window.localStorage.getItem(IGNORE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setIgnored(): void {
  try {
    window.localStorage.setItem(IGNORE_KEY, "1");
  } catch {
    // Storage unavailable — nothing to do; ignore() must fail silently.
  }
}
