export type Device = "desktop" | "mobile" | "tablet";

/**
 * Coarse device classification from User-Agent — enough for the dashboard's
 * device breakdown. Deliberately not a full UA-parsing library; add cases
 * only when a real misclassification shows up in real data.
 */
export function classifyDevice(userAgent: string): Device {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobi|iphone|android/.test(ua)) return "mobile";
  return "desktop";
}
