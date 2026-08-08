/**
 * Hostname only — never the full referrer URL, which can carry query-string
 * PII from the referring page (e.g. a password-reset token, a pre-filled
 * email address).
 */
export function getReferrerHostname(): string {
  if (!document.referrer) return "";
  try {
    return new URL(document.referrer).hostname;
  } catch {
    return "";
  }
}
