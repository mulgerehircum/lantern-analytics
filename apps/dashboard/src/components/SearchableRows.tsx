"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { theme } from "@/lib/theme";

/**
 * Collapsed to `initialVisibleCount` rows behind a "Show N more" toggle by
 * default (same as the old ExpandableRows) — typing in the search box
 * bypasses that cap entirely and searches the full row set instead, since
 * "find this specific thing" shouldn't require clicking "show more" first.
 *
 * Takes already-rendered `{key, node}` pairs, not raw row data: a
 * DataTableRow can carry a `renderKey` function (e.g. Countries' flag
 * lookup), and functions can't be passed as props across the server/client
 * boundary — the caller (a Server Component) renders each <Row> itself and
 * pairs it with its plain-string key for matching, so only strings and
 * already-built React elements ever cross the boundary.
 */
export function SearchableRows({
  rows,
  initialVisibleCount,
}: {
  rows: Array<{ key: string; node: ReactNode }>;
  initialVisibleCount: number;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const q = query.trim().toLowerCase();

  const visible = q ? rows.filter((r) => r.key.toLowerCase().includes(q)) : expanded ? rows : rows.slice(0, initialVisibleCount);
  const hiddenCount = !q && !expanded ? rows.length - initialVisibleCount : 0;

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search…"
        style={{
          display: "block",
          width: "100%",
          boxSizing: "border-box",
          border: `1px solid ${theme.color.fieldBorder}`,
          borderRadius: theme.radius.small,
          padding: "5px 8px",
          fontSize: "0.8rem",
          fontFamily: "inherit",
          marginBottom: "0.4rem",
        }}
      />
      {visible.length === 0 ? (
        <p style={{ color: theme.color.textFaint, fontSize: "0.82rem", margin: 0 }}>No matches</p>
      ) : (
        visible.map((r) => <span key={r.key}>{r.node}</span>)
      )}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          style={{
            display: "block",
            width: "100%",
            background: "none",
            border: "none",
            padding: "0.4rem 0.5rem 0",
            margin: 0,
            fontSize: "0.78rem",
            color: theme.color.brand,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          Show {hiddenCount} more
        </button>
      )}
      {expanded && !q && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          style={{
            display: "block",
            width: "100%",
            background: "none",
            border: "none",
            padding: "0.4rem 0.5rem 0",
            margin: 0,
            fontSize: "0.78rem",
            color: theme.color.brand,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          Show less
        </button>
      )}
    </div>
  );
}
