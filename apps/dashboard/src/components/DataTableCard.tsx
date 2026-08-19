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
 * One data-table card (Top pages / Referrers / Countries / Devices / Custom
 * events / Custom event details). Presentational only — filter-agnostic; the
 * caller (page.tsx) decides each row's href via lib/filter-ui.ts.
 *
 * `initialVisibleCount`, when set and rows exceed it, shows only that many
 * rows behind a "Show N more" toggle, with a search box that bypasses the
 * cap entirely once you start typing (see SearchableRows).
 * `exportFilename`, when set, adds a CSV-export button built from `key`/
 * `count` only (renderKey's JSX, e.g. Countries' flag icon, has no CSV use —
 * the raw key string is the correct cell value regardless).
 */
export function DataTableCard({
  title,
  rows,
  initialVisibleCount,
  exportFilename,
}: {
  title: string;
  rows: readonly DataTableRow[];
  initialVisibleCount?: number;
  exportFilename?: string;
}) {
  const searchable = initialVisibleCount !== undefined && rows.length > initialVisibleCount;

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.7rem" }}>
        <div style={{ fontWeight: theme.font.weight.semibold, fontSize: "0.85rem" }}>{title}</div>
        {exportFilename && rows.length > 0 && <ExportCsvButton csv={buildRowsCsv(rows)} filename={exportFilename} />}
      </div>
      {rows.length === 0 ? (
        <p style={{ color: theme.color.textFaint, fontSize: "0.82rem", margin: 0 }}>No data yet</p>
      ) : searchable ? (
        <SearchableRows
          rows={rows.map((row) => ({ key: row.key, node: <Row key={row.key} row={row} /> }))}
          initialVisibleCount={initialVisibleCount!}
        />
      ) : (
        rows.map((row) => <Row key={row.key} row={row} />)
      )}
    </div>
  );
}

export function Row({ row }: { row: DataTableRow }) {
  const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    padding: "0.35rem 0.5rem",
    margin: "0 -0.5rem",
    fontSize: "0.82rem",
    borderBottom: `1px solid ${theme.color.cardBorder}`,
    borderRadius: theme.radius.small,
    background: row.active ? theme.color.brandTintBg : "transparent",
    textDecoration: "none",
    color: "inherit",
  };
  const content = (
    <>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: "0.6rem" }}>
        {row.renderKey ? row.renderKey(row.key) : row.key || "(empty)"}
      </span>
      <span style={{ fontWeight: theme.font.weight.semibold, flexShrink: 0 }}>{row.count}</span>
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
