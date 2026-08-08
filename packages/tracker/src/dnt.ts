/**
 * Respect Do Not Track as a real behavioral commitment: if set, the tracker
 * no-ops entirely rather than just recording the preference somewhere.
 * "1"/"yes" covers current and legacy browser implementations.
 */
export function isDoNotTrackEnabled(): boolean {
  const dnt =
    navigator.doNotTrack ??
    (window as unknown as { doNotTrack?: string }).doNotTrack;
  return dnt === "1" || dnt === "yes";
}
