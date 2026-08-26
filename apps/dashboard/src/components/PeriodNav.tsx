import Link from "next/link";
import { theme } from "@/lib/theme";
import { formatDayLabel, shiftDay, } from "@/lib/months";

/**
 * Secondary prev/next affordance next to Breadcrumb in the chart card —
 * Breadcrumb now owns "go up a level" (it replaced these components' old
 * "(all time)"/"(up to X)" trailing link), so these only shift sideways
 * within the current depth.
 */

export function DayNav({ siteId, day }: { siteId: string; day: string }) {
  const prev = shiftDay(day, -1);
  const next = shiftDay(day, 1);
  return (
    <p style={navStyle}>
      <Link href={`/?siteId=${encodeURIComponent(siteId)}&month=${prev}`} style={navLinkStyle}>
        ← {formatDayLabel(prev)}
      </Link>
      <Link href={`/?siteId=${encodeURIComponent(siteId)}&month=${next}`} style={navLinkStyle}>
        {formatDayLabel(next)} →
      </Link>
    </p>
  );
}

const navStyle: React.CSSProperties = { fontSize: "0.72rem", margin: 0, display: "flex", gap: "0.6rem", alignItems: "center" };
const navLinkStyle: React.CSSProperties = { color: theme.color.textMutedLight, textDecoration: "none" };
