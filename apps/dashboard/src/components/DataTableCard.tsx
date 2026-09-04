import type { ReactNode } from "react";
import Link from "next/link";
import { card, theme } from "@/lib/theme";
import { SearchableRows } from "./SearchableRows";
import { ExportCsvButton } from "./ExportCsvButton";
import { buildRowsCsv } from "@/lib/csv";

export interface DataTableRow {
  key: string;
  count: number;
  /** Omitted for empty-state rows, which render as plain non-interactive text. */
  href?: string;
  active?: boolean;
  renderKey?: (key: string) => ReactNode;
}

/**
 * One data-table card (Top pages / Referrers / Countries / Custom event
 * details). Presentational only - filter-agnostic; the caller (page.tsx)
 * decides each row's href via lib/filter-ui.ts.
 *
 * `initialVisibleCount`, when set and rows exceed it, shows only that many
 * rows behind a "Show N more" toggle, with a search box that bypasses the
 * cap entirely once you start typing (see SearchableRows). `searchAlways`
 * forces the search box even below the cap (the Countries card's featured
 * filter). `exportFilename`, when set, adds a CSV-export button built from
 * `key`/`count` only (renderKey's JSX, e.g. Countries' flag icon, has no CSV
 * use - the raw key string is the correct cell value regardless).
 * `footnote`, when set, renders a muted callout under the rows.
 */
export function DataTableCard({
  title,
  subtitle,
  icon,
  rows,
  initialVisibleCount,
  exportFilename,
  searchAlways,
  searchPlaceholder,
  listMaxHeight,
  footnote,
}: {
  title: string;
  subtitle?: string;
  /** Full Font Awesome classes shown before the title, e.g. "fa-solid fa-earth-americas". */
  icon?: string;
  rows: readonly DataTableRow[];
  initialVisibleCount?: number;
  exportFilename?: string;
  searchAlways?: boolean;
  searchPlaceholder?: string;
  listMaxHeight?: string;
  footnote?: string;
}) {
  const searchable = searchAlways || (initialVisibleCount !== undefined && rows.length > initialVisibleCount);
  const maxCount = rows.length ? Math.max(...rows.map((r) => r.count), 0) : 0;

  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: "0.75rem",
          borderBottom: `1px solid ${theme.color.border}`,
          marginBottom: "0.75rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {icon && <i className={icon} style={{ color: theme.color.textMuted, fontSize: "0.75rem" }} />}
            <div style={{ fontWeight: theme.font.weight.bold, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {title}
            </div>
          </div>
          {subtitle && <div style={{ fontSize: "0.6875rem", color: theme.color.textMuted, marginTop: "0.125rem" }}>{subtitle}</div>}
        </div>
        {exportFilename && rows.length > 0 && <ExportCsvButton csv={buildRowsCsv(rows)} filename={exportFilename} />}
      </div>
      {rows.length === 0 ? (
        <p style={{ color: theme.color.textFaint, fontSize: "0.82rem", margin: 0 }}>No data yet</p>
      ) : searchable ? (
        <SearchableRows
          rows={rows.map((row) => ({ key: row.key, node: <Row key={row.key} row={row} maxCount={maxCount} /> }))}
          initialVisibleCount={initialVisibleCount ?? rows.length}
          placeholder={searchPlaceholder}
          maxHeight={listMaxHeight}
        />
      ) : (
        rows.map((row) => <Row key={row.key} row={row} maxCount={maxCount} />)
      )}
      {footnote && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            borderRadius: theme.radius.control,
            background: theme.color.bg,
            border: `1px solid ${theme.color.border}`,
            fontSize: "0.6875rem",
            color: theme.color.textMuted,
            lineHeight: 1.5,
          }}
        >
          {footnote}
        </div>
      )}
    </div>
  );
}

export function Row({ row, maxCount }: { row: DataTableRow; maxCount?: number }) {
  const pct = maxCount && maxCount > 0 ? (row.count / maxCount) * 100 : 0;
  const rowStyle: React.CSSProperties = {
    display: "block",
    padding: "0.4rem 0",
    fontSize: "0.75rem",
    borderRadius: theme.radius.small,
    background: row.active ? theme.color.brandTintBg : "transparent",
    textDecoration: "none",
    color: "inherit",
  };
  const content = (
    <>
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.6rem", marginBottom: "0.25rem" }}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: theme.font.weight.medium }}>
          {row.renderKey ? row.renderKey(row.key) : row.key || "(empty)"}
        </span>
        <span style={{ flexShrink: 0, fontFamily: theme.font.mono }}>
          <span style={{ fontWeight: theme.font.weight.bold }}>{row.count}</span>{" "}
          <span style={{ color: theme.color.textFaint, fontSize: "0.625rem" }}>({pct.toFixed(1)}%)</span>
        </span>
      </span>
      <span
        aria-hidden
        style={{ display: "block", height: 6, borderRadius: 999, background: theme.color.bg, border: `1px solid ${theme.color.border}`, overflow: "hidden" }}
      >
        <span style={{ display: "block", height: "100%", width: `${pct}%`, borderRadius: 999, background: theme.color.brand }} />
      </span>
    </>
  );

  return row.href ? (
    <Link href={row.href} style={rowStyle}>
      {content}
    </Link>
  ) : (
    <div style={rowStyle}>{content}</div>
  );
}
