import Link from "next/link";
import { theme } from "@/lib/theme";
import { formatHeaderRangeLabel, prevNextPeriod } from "@/lib/header";
import { HeaderProjectSwitcher } from "./HeaderProjectSwitcher";
import { HeaderSearch } from "./HeaderSearch";
import { ExportCsvButton } from "./ExportCsvButton";

/**
 * Top header bar for the overview page - context, live presence, time
 * window, and primary actions in one 64px row above the metric grid.
 * Server-rendered: the stepper is plain links, search is a native GET form
 * (the "/" focus shortcut is the only client JS, inside HeaderSearch), and
 * the CSV string is built server-side for ExportCsvButton.
 *
 * Bleeds to the content column edges (negative margins matching AppShell's
 * padding) so the bottom border spans the full column width.
 */
export function HeaderBar({
  siteId,
  siteName,
  unregistered,
  siteUrl,
  liveVisitors,
  selectedPeriod,
  isDay,
  isHour,
  searchDefault,
  overviewCsv,
  csvFilename,
}: {
  siteId: string;
  siteName: string;
  /** Flags a siteId missing from the registry (data still renders). */
  unregistered?: boolean;
  siteUrl?: string;
  /** Live unique visitors in the current hour (0 hides the pill). */
  liveVisitors: number;
  selectedPeriod?: string;
  isDay: boolean;
  isHour: boolean;
  searchDefault?: string;
  overviewCsv: string;
  csvFilename: string;
}) {
  const rangeLabel = formatHeaderRangeLabel(selectedPeriod, isDay, isHour);
  const step = prevNextPeriod(selectedPeriod, isDay, isHour);
  const stepperHref = (period: string) => `/?siteId=${encodeURIComponent(siteId)}&month=${encodeURIComponent(period)}`;

  return (
    <div
      className="lantern-headerbar"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "0.75rem",
        flexWrap: "wrap",
        minHeight: 64,
        padding: "1rem 1.5rem",
        margin: "-2.5rem -2.5rem 1.25rem",
        borderBottom: `1px solid ${theme.color.border}`,
        background: theme.color.bg,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem" }}>
          <span style={{ fontWeight: theme.font.weight.semibold, color: theme.color.text }}>{siteName}</span>
          {unregistered && (
            <span style={{ fontSize: "0.75rem", fontWeight: 400, color: theme.color.amber }}>- not in site registry</span>
          )}
          <span style={{ color: theme.color.textFaint }}>/</span>
          <HeaderProjectSwitcher siteId={siteId} />
        </div>
        {liveVisitors > 0 && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              background: theme.color.brandTintBg,
              color: theme.color.brandTintTextStrong,
              fontSize: "0.75rem",
              fontWeight: theme.font.weight.medium,
              padding: "0.25rem 0.625rem",
              borderRadius: theme.radius.pill,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.color.brand, display: "inline-block" }} />
            {liveVisitors} visitor{liveVisitors === 1 ? "" : "s"} online
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: theme.color.cardBg,
            border: `1px solid ${theme.color.fieldBorder}`,
            borderRadius: theme.radius.small,
            padding: "0.375rem 0.625rem",
            fontSize: "0.75rem",
            color: theme.color.text,
          }}
        >
          <svg
            aria-hidden
            width={14}
            height={14}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            style={{ marginRight: "0.375rem", color: theme.color.textMuted, flexShrink: 0 }}
          >
            <rect x={1.5} y={2.5} width={13} height={12} rx={2} />
            <line x1={1.5} y1={6} x2={14.5} y2={6} />
            <line x1={5} y1={1} x2={5} y2={4} />
            <line x1={11} y1={1} x2={11} y2={4} />
          </svg>
          <span style={{ fontWeight: theme.font.weight.medium, whiteSpace: "nowrap" }}>{rangeLabel}</span>
          {step && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                marginLeft: "0.5rem",
                paddingLeft: "0.5rem",
                borderLeft: `1px solid ${theme.color.border}`,
                color: theme.color.textMuted,
              }}
            >
              <Link href={stepperHref(step.prev)} aria-label="Previous period" style={{ color: "inherit", textDecoration: "none", padding: "0 0.25rem" }}>
                &lt;
              </Link>
              <Link href={stepperHref(step.next)} aria-label="Next period" style={{ color: "inherit", textDecoration: "none", padding: "0 0.25rem" }}>
                &gt;
              </Link>
            </span>
          )}
        </div>

        <HeaderSearch siteId={siteId} defaultValue={searchDefault} />

        {siteUrl && (
          <a
            href={siteUrl}
            target="_blank"
            rel="noreferrer"
            className="lantern-header-collapsible"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              height: 32,
              padding: "0 0.625rem",
              background: theme.color.cardBg,
              border: `1px solid ${theme.color.border}`,
              borderRadius: theme.radius.small,
              fontSize: "0.75rem",
              fontWeight: theme.font.weight.medium,
              color: theme.color.textMuted,
              textDecoration: "none",
            }}
          >
            <span aria-hidden>↗</span>
            <span>Live View</span>
          </a>
        )}

        <ExportCsvButton csv={overviewCsv} filename={csvFilename} variant="primary" />
      </div>
    </div>
  );
}
