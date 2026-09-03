"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { theme } from "@/lib/theme";

/**
 * One bar in the hourly time-series chart. Same reasoning as LocalDateTime:
 * the `hour` prop is a real UTC ISO timestamp (start of that hour), and the
 * tooltip needs to show it in whoever's looking at the page's own local
 * time/locale, not the server's. `title` is a plain HTML attribute - it
 * can't hold a child component - so this bar itself has to be the client
 * boundary, not just its label.
 *
 * SSRs the raw ISO string as the tooltip (stable, no hydration mismatch),
 * then swaps to the formatted local string after mount.
 *
 * `heightPx`, not a CSS percentage: when `href` is set, this bar's direct
 * parent becomes the `<a>` wrapping it, which has no explicit height of its
 * own - a `%` height resolves against that undefined height and collapses
 * to 0 (the exact bug already hit once before in MonthlyTrendChart/
 * DailyTrendChart, for the identical reason). A pixel value has no such
 * dependency.
 */
export function HourBar({
  hour,
  pageviews,
  heightPx,
  href,
}: {
  hour: string;
  pageviews: number;
  heightPx: number;
  href?: string;
}) {
  const [label, setLabel] = useState(hour);

  useEffect(() => {
    // dateStyle/timeStyle "short", not the bare toLocaleString() default -
    // an hour bucket always lands exactly on the hour, so the default's
    // seconds are always a redundant ":00".
    setLabel(new Date(hour).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }));
  }, [hour]);

  const bar = (
    <div
      title={`${label}: ${pageviews} pageview${pageviews === 1 ? "" : "s"}`}
      style={{
        width: 12,
        height: heightPx,
        background: theme.color.brand,
        borderRadius: "4px 4px 0 0",
      }}
    />
  );

  return href ? <Link href={href}>{bar}</Link> : bar;
}
