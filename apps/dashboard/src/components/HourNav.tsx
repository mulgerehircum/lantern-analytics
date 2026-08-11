"use client";

import { useEffect, useState } from "react";
import { shiftHour, parentDay, formatDayLabel, formatHourLabel } from "@/lib/months";

/**
 * Prev/next/back nav for the hour-level drill-down — same shape as
 * MonthNav/DayNav, but a client component: an hour boundary is exactly the
 * granularity where UTC-vs-local timezone actually matters (a "21:00 UTC"
 * bucket is a different wall-clock hour depending on who's looking), unlike
 * month/day labels which stay pure UTC string math. Shifting itself still
 * moves by UTC hour buckets — that's the real unit of stored data; only the
 * displayed label localizes. SSRs the UTC-labeled fallback (formatHourLabel)
 * first, swaps to the browser's local time after mount, same pattern as
 * LocalDateTime/HourBar.
 */
export function HourNav({ siteId, hour }: { siteId: string; hour: string }) {
  const prev = shiftHour(hour, -1);
  const next = shiftHour(hour, 1);
  const day = parentDay(hour);

  const [labels, setLabels] = useState<{ prev: string; current: string; next: string } | null>(null);

  useEffect(() => {
    const toLocal = (h: string) => new Date(`${h}:00:00.000Z`).toLocaleString();
    setLabels({ prev: toLocal(prev), current: toLocal(hour), next: toLocal(next) });
  }, [hour, prev, next]);

  return (
    <p style={{ fontSize: "0.85rem", margin: "0.25rem 0 0", display: "flex", gap: "0.75rem", alignItems: "center" }}>
      <a href={`/?siteId=${encodeURIComponent(siteId)}&month=${prev}`} style={{ color: "#4f46e5" }}>
        ← {labels ? labels.prev : formatHourLabel(prev)}
      </a>
      <strong>{labels ? labels.current : formatHourLabel(hour)}</strong>
      <a href={`/?siteId=${encodeURIComponent(siteId)}&month=${next}`} style={{ color: "#4f46e5" }}>
        {labels ? labels.next : formatHourLabel(next)} →
      </a>
      <a href={`/?siteId=${encodeURIComponent(siteId)}&month=${day}`} style={{ color: "#666" }}>
        (up to {formatDayLabel(day)})
      </a>
    </p>
  );
}
