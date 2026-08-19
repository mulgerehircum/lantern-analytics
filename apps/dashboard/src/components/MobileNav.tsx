"use client";

import { useState } from "react";
import type { ReactNode } from "react";

/** Must match Sidebar.tsx's <aside> width — hiding the drawer means offsetting it fully off-screen. */
const SIDEBAR_WIDTH = 250;

/**
 * Wraps the already-rendered <Sidebar> output (pre-rendered JSX crossing the
 * boundary, same pattern as SearchableRows/ExportCsvButton — no raw nav data
 * needed here, just a place to toggle visibility). Below the 768px
 * breakpoint (see the <style> block in layout.tsx), the sidebar becomes an
 * off-canvas drawer behind this hamburger button; above it, the button is
 * hidden by CSS and the sidebar renders exactly as it always has.
 *
 * The drawer's open/closed position is driven by an inline `left` style
 * computed straight from React state, not by toggling a CSS class that sets
 * `transform` — a transform-based version of this didn't reliably animate,
 * and `left` is trivial to verify (real layout position via
 * getBoundingClientRect, not just a computed-style string) and universally
 * supported with zero specificity/compositing surprises.
 *
 * No close-on-navigate handler needed: every Sidebar link is a plain <a
 * href> full-page load under this app's query-param routing (no
 * client-side router), so the menu naturally starts closed again on
 * whatever page loads next.
 */
export function MobileNav({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="lantern-hamburger"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? "✕" : "☰"}
      </button>
      {open && <div className="lantern-mobile-backdrop" onClick={() => setOpen(false)} />}
      <div className="lantern-sidebar-wrap" style={{ left: open ? 0 : -SIDEBAR_WIDTH }}>
        {children}
      </div>
    </>
  );
}
