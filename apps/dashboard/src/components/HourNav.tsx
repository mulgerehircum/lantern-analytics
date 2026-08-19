"use client";

import { useEffect, useState } from "react";
import { theme } from "@/lib/theme";
import { shiftHour, formatHourLabel } from "@/lib/months";

/**
 * Secondary prev/next affordance for the hour-level drill-down, next to
 * Breadcrumb in the chart card (which now owns "go up a level" — this
 * dropped its old "(up to X)" trailing link). A client component: an hour
 * boundary is exactly the granularity where UTC-vs-local timezone actually
 * matters (a "21:00 UTC" bucket is a different wall-clock hour depending on
 * who's looking), unlike month/day labels which stay pure UTC string math.
 * Shifting itself still moves by UTC hour buckets — that's the real unit of
 * stored data; only the displayed label localizes. SSRs the UTC-labeled
 * fallback (formatHourLabel) first, swaps to the browser's local time after
 * mount, same pattern as LocalDateTime/HourBar.
 */
export function HourNav({ siteId, hour }: { siteId: string; hour: string }) {
  const prev = shiftHour(hour, -1);
  const next = shiftHour(hour, 1);

  const [labels, setLabels] = useState<{ prev: string; next: string } | null>(null);

  useEffect(() => {
    // dateStyle/timeStyle "short" — an hour bucket always lands exactly on
    // the hour, so the bare toLocaleString() default's seconds are always a
    // redundant ":00".
    const toLocal = (h: string) => new Date(`${h}:00:00.000Z`).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
    setLabels({ prev: toLocal(prev), next: toLocal(next) });
  }, [prev, next]);

  return (
    <p style={{ fontSize: "0.72rem", margin: 0, display: "flex", gap: "0.6rem", alignItems: "center" }}>
      <a href={`/?siteId=${encodeURIComponent(siteId)}&month=${prev}`} style={{ color: theme.color.textMutedLight, textDecoration: "none" }}>
        ← {labels ? labels.prev : formatHourLabel(prev)}
      </a>
      <a href={`/?siteId=${encodeURIComponent(siteId)}&month=${next}`} style={{ color: theme.color.textMutedLight, textDecoration: "none" }}>
        {labels ? labels.next : formatHourLabel(next)} →
      </a>
    </p>
  );
}
