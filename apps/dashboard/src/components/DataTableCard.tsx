import type { ReactNode } from "react";
import { card, theme } from "@/lib/theme";
import { ExpandableRows } from "./ExpandableRows";

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
 * rows with the rest behind a "Show N more" toggle (see ExpandableRows).
 */
export function DataTableCard({
  title,
  rows,
  initialVisibleCount,
}: {
  title: string;
  rows: readonly DataTableRow[];
  initialVisibleCount?: number;
}) {
  const collapsible = initialVisibleCount !== undefined && rows.length > initialVisibleCount;
  const visibleRows = collapsible ? rows.slice(0, initialVisibleCount) : rows;
  const hiddenRows = collapsible ? rows.slice(initialVisibleCount) : [];

  return (
    <div style={card}>
      <div style={{ fontWeight: theme.font.weight.semibold, marginBottom: "0.7rem", fontSize: "0.85rem" }}>{title}</div>
      {rows.length === 0 ? (
        <p style={{ color: "#999", fontSize: "0.82rem", margin: 0 }}>No data yet</p>
      ) : (
        <>
          {visibleRows.map((row) => (
            <Row key={row.key} row={row} />
          ))}
          {collapsible && (
            <ExpandableRows count={hiddenRows.length}>
              {hiddenRows.map((row) => (
                <Row key={row.key} row={row} />
              ))}
            </ExpandableRows>
          )}
        </>
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
    <a href={row.href} style={rowStyle}>
      {content}
    </a>
  ) : (
    <div style={rowStyle}>{content}</div>
  );
}
