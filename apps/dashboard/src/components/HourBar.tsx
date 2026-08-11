"use client";

import { useEffect, useState } from "react";

/**
 * One bar in the hourly time-series chart. Same reasoning as LocalDateTime:
 * the `hour` prop is a real UTC ISO timestamp (start of that hour), and the
 * tooltip needs to show it in whoever's looking at the page's own local
 * time/locale, not the server's. `title` is a plain HTML attribute — it
 * can't hold a child component — so this bar itself has to be the client
 * boundary, not just its label.
 *
 * SSRs the raw ISO string as the tooltip (stable, no hydration mismatch),
 * then swaps to the formatted local string after mount.
 */
export function HourBar({
  hour,
  pageviews,
  heightPct,
  href,
}: {
  hour: string;
  pageviews: number;
  heightPct: number;
  href?: string;
}) {
  const [label, setLabel] = useState(hour);

  useEffect(() => {
    setLabel(new Date(hour).toLocaleString());
  }, [hour]);

  const bar = (
    <div
      title={`${label}: ${pageviews} pageview${pageviews === 1 ? "" : "s"}`}
      style={{
        width: 12,
        height: `${heightPct}%`,
        background: "#4f46e5",
        borderRadius: "2px 2px 0 0",
      }}
    />
  );

  return href ? <a href={href}>{bar}</a> : bar;
}
