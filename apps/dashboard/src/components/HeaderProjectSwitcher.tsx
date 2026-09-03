"use client";

import { SITES } from "@/lib/sites";
import { theme } from "@/lib/theme";

/**
 * Compact project switcher for the header breadcrumb - a plain GET form
 * whose select auto-submits on change (the sidebar's ProjectSelector keeps
 * its explicit arrow button instead, since a select there has room for one
 * and this one does not). Navigating clears other query params: switching
 * projects is a "start fresh here" action, same as the sidebar.
 */
export function HeaderProjectSwitcher({ siteId }: { siteId: string }) {
  return (
    <form method="GET" action="/" style={{ margin: 0, display: "inline-flex" }}>
      <select
        name="siteId"
        defaultValue={siteId}
        aria-label="Switch project"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        style={{
          border: "none",
          background: "transparent",
          padding: 0,
          fontSize: "0.875rem",
          fontFamily: "inherit",
          color: theme.color.textMuted,
          cursor: "pointer",
          maxWidth: 160,
        }}
      >
        {SITES.map((s) => (
          <option key={s.siteId} value={s.siteId}>
            {s.name}
          </option>
        ))}
        {!SITES.some((s) => s.siteId === siteId) && <option value={siteId}>{siteId} (unregistered)</option>}
      </select>
    </form>
  );
}
