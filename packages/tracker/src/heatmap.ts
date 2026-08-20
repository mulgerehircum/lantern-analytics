/**
 * Page-relative (not viewport-relative) click position, as 0-100 integers —
 * scroll position doesn't matter, and it's comparable across visits with
 * different viewport sizes without needing to store raw pixel coordinates.
 */
export function computeClickPercent(
  point: { pageX: number; pageY: number },
  doc: { scrollWidth: number; scrollHeight: number },
): { xPct: number; yPct: number } {
  const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
  const xPct = doc.scrollWidth > 0 ? clamp((point.pageX / doc.scrollWidth) * 100) : 0;
  const yPct = doc.scrollHeight > 0 ? clamp((point.pageY / doc.scrollHeight) * 100) : 0;
  return { xPct, yPct };
}
