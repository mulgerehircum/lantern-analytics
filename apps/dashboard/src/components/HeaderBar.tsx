import Link from "next/link";
import { theme } from "@/lib/theme";
import { formatHeaderRangeLabel, prevNextPeriod } from "@/lib/header";
import { HeaderSearch } from "./HeaderSearch";
import { ExportCsvButton } from "./ExportCsvButton";

/**
 * Top header bar for the overview page - breadcrumb, live presence, time
 * window, and primary actions in one 56px row above the metric grid.
 * Server-rendered: the stepper is plain links, search is a native GET form
 * (the "/" focus shortcut is the only client JS, inside HeaderSearch), and
 * the CSV string is built server-side for ExportCsvButton.
 *
 * Rendered via AppShell's `header` slot, outside the max-width content
 * container, so the bottom border spans the full column width at any
 * viewport.
 */
export function HeaderBar({
  siteId,
  siteName,
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
  // "Portfolio (folio-v1)" renders as bold Portfolio / muted folio-v1;
  // names without that shape render whole and bold.
  const nameMatch = siteName.match(/^(.*) \((.*)\)$/);

  return (
    <div
      className="lantern-headerbar"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "0.75rem",
        minHeight: 56,
        padding: "0 1.5rem",
        margin: 0,
        borderBottom: `1px solid ${theme.color.border}`,
        background: theme.color.cardBg,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.875rem", fontWeight: theme.font.weight.bold, color: theme.color.text }}>
            {nameMatch ? nameMatch[1] : siteName}
          </span>
          {nameMatch && (
            <>
              <span style={{ color: theme.color.underline }}>/</span>
              <span style={{ fontSize: "0.75rem", fontWeight: theme.font.weight.medium, color: theme.color.textMuted }}>
                {nameMatch[2]}
              </span>
            </>
          )}
        </div>
        <span style={{ height: 16, width: 1, background: theme.color.border, margin: "0 0.25rem" }} />
        {liveVisitors > 0 && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: theme.color.brandTintBg,
              color: theme.color.brandTintTextStrong,
              fontSize: "0.75rem",
              fontWeight: theme.font.weight.semibold,
              padding: "0.25rem 0.625rem",
              borderRadius: theme.radius.pill,
              border: `1px solid ${theme.color.border}`,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
              <span className="lantern-ping" style={{ position: "absolute", display: "inline-flex", width: "100%", height: "100%" }} />
              <span style={{ position: "relative", display: "inline-flex", borderRadius: "50%", width: 8, height: 8, background: theme.color.brand }} />
            </span>
            {liveVisitors} visitor{liveVisitors === 1 ? "" : "s"} online
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: theme.color.bg,
            border: `1px solid ${theme.color.fieldBorder}`,
            borderRadius: theme.radius.control,
            padding: "0.125rem",
            height: 32,
            boxSizing: "border-box",
            fontSize: "0.75rem",
            color: theme.color.textMuted,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.25rem 0.625rem",
              fontWeight: theme.font.weight.medium,
              color: theme.color.text,
              whiteSpace: "nowrap",
            }}
          >
            <i className="fa-regular fa-calendar" style={{ fontSize: "0.6875rem", marginRight: "0.375rem", color: theme.color.textFaint }} />
            {rangeLabel}
          </span>
          {step && (
            <>
              <span style={{ height: 12, width: 1, background: theme.color.border }} />
              <Link href={stepperHref(step.prev)} aria-label="Previous period" style={{ color: "inherit", textDecoration: "none", padding: "0.25rem 0.5rem" }}>
                <i className="fa-solid fa-angle-left" style={{ fontSize: "0.625rem" }} />
              </Link>
              <Link href={stepperHref(step.next)} aria-label="Next period" style={{ color: "inherit", textDecoration: "none", padding: "0.25rem 0.5rem" }}>
                <i className="fa-solid fa-angle-right" style={{ fontSize: "0.625rem" }} />
              </Link>
            </>
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
              boxSizing: "border-box",
              padding: "0 0.75rem",
              background: theme.color.bg,
              border: `1px solid ${theme.color.fieldBorder}`,
              borderRadius: theme.radius.control,
              fontSize: "0.75rem",
              fontWeight: theme.font.weight.medium,
              color: theme.color.text,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: "0.625rem", color: theme.color.textFaint }} />
            Live View
          </a>
        )}

        <ExportCsvButton csv={overviewCsv} filename={csvFilename} variant="primary" />
      </div>
    </div>
  );
}
