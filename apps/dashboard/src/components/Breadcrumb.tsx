import Link from "next/link";
import { theme } from "@/lib/theme";
import { formatDayLabel, formatMonthLabel, parentDay, parentMonth } from "@/lib/months";

/**
 * "All time › August 2026 › Aug 15" trail above the Overview chart - each
 * segment before the current one links up to that depth (same targets
 * MonthNav/DayNav/HourNav's old "(all time)"/"(up to X)" links already used),
 * clicking a chart bar still drills one level deeper (unchanged, handled by
 * the bar components themselves). The current depth's segment is plain text.
 */
export function Breadcrumb({
  siteId,
  selectedPeriod,
  isDay,
  isHour,
}: {
  siteId: string;
  selectedPeriod?: string;
  isDay: boolean;
  isHour: boolean;
}) {
  const qs = (params: Record<string, string>) => `/?${new URLSearchParams(params).toString()}`;

  const segments: Array<{ label: string; href?: string }> = [{ label: "All time", href: qs({ siteId }) }];

  if (selectedPeriod) {
    const month = isHour ? parentMonth(parentDay(selectedPeriod)) : isDay ? parentMonth(selectedPeriod) : selectedPeriod;
    segments.push({ label: formatMonthLabel(month), href: qs({ siteId, month }) });

    if (isDay || isHour) {
      const day = isHour ? parentDay(selectedPeriod) : selectedPeriod;
      segments.push({ label: formatDayLabel(day), href: qs({ siteId, month: day }) });
    }

    if (isHour) {
      const [, hourNum] = selectedPeriod.split("T");
      segments.push({ label: `${hourNum}:00`, href: undefined });
    }
  }

  // The current depth is always the last segment - never a link, even though
  // an href was computed above (its own destination is the current page).
  const last = segments.length - 1;

  return (
    <nav style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem" }}>
      {segments.map((seg, i) =>
        i === last ? (
          <span key={seg.label} style={{ fontWeight: theme.font.weight.semibold, color: theme.color.text }}>
            {seg.label}
          </span>
        ) : (
          <span key={seg.label} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            {/* seg.href is always defined here - only the last segment (handled above) ever omits it */}
            <Link href={seg.href!} style={{ color: theme.color.textMuted, textDecoration: "none" }}>
              {seg.label}
            </Link>
            <span style={{ color: theme.color.textMuted }}>›</span>
          </span>
        ),
      )}
    </nav>
  );
}

