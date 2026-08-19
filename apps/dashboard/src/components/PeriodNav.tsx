import { theme } from "@/lib/theme";
import { formatDayLabel, formatMonthLabel, shiftDay, shiftMonth } from "@/lib/months";

/**
 * Secondary prev/next affordance next to Breadcrumb in the chart card —
 * Breadcrumb now owns "go up a level" (it replaced these components' old
 * "(all time)"/"(up to X)" trailing link), so these only shift sideways
 * within the current depth.
 */
export function MonthNav({ siteId, month }: { siteId: string; month: string }) {
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  return (
    <p style={navStyle}>
      <a href={`/?siteId=${encodeURIComponent(siteId)}&month=${prev}`} style={navLinkStyle}>
        ← {formatMonthLabel(prev)}
      </a>
      <a href={`/?siteId=${encodeURIComponent(siteId)}&month=${next}`} style={navLinkStyle}>
        {formatMonthLabel(next)} →
      </a>
    </p>
  );
}

export function DayNav({ siteId, day }: { siteId: string; day: string }) {
  const prev = shiftDay(day, -1);
  const next = shiftDay(day, 1);
  return (
    <p style={navStyle}>
      <a href={`/?siteId=${encodeURIComponent(siteId)}&month=${prev}`} style={navLinkStyle}>
        ← {formatDayLabel(prev)}
      </a>
      <a href={`/?siteId=${encodeURIComponent(siteId)}&month=${next}`} style={navLinkStyle}>
        {formatDayLabel(next)} →
      </a>
    </p>
  );
}

const navStyle: React.CSSProperties = { fontSize: "0.72rem", margin: 0, display: "flex", gap: "0.6rem", alignItems: "center" };
const navLinkStyle: React.CSSProperties = { color: theme.color.textMutedLight, textDecoration: "none" };
