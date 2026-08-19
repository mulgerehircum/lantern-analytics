"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { theme } from "@/lib/theme";

/**
 * The collapsed tail of a DataTableCard, behind a "Show N more" toggle.
 * Tried native <details>/<summary> first (zero client JS, matches the rest
 * of the dashboard's convention) — dropped it because each Row sets an
 * inline `display: flex` on itself, which (inline styles beating any
 * stylesheet rule) overrides the browser's `details:not([open]) *
 * {display:none}` and defeats the native collapse. Explicit state is the
 * reliable option, and it has a side benefit: `children` (the extra rows)
 * only ever render while expanded, so the toggle is always the last element
 * in the card — no ordering trick needed to keep it pinned to the bottom.
 *
 * Takes already-rendered `children`, not raw row data: DataTableRow can
 * carry a `renderKey` function (e.g. Countries' flag lookup), and functions
 * can't be passed as props across the server/client boundary — the caller
 * (a Server Component) renders the hidden <Row>s itself and hands over the
 * resulting elements, which serialize fine.
 */
export function ExpandableRows({ count, children }: { count: number; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {expanded && children}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        style={{
          display: "block",
          width: "100%",
          background: "none",
          border: "none",
          // Mirrors Row's box model (margin: "0 -0.5rem" + padding: "0 0.5rem")
          // so the button's text lines up flush with the row content above
          // it instead of sitting 0.5rem further right.
          margin: "0 -0.5rem",
          padding: "0.4rem 0.5rem 0",
          fontSize: "0.78rem",
          color: theme.color.brand,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {expanded ? "Show less" : `Show ${count} more`}
      </button>
    </>
  );
}
