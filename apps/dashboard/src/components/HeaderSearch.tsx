"use client";

import { useEffect, useRef } from "react";
import { theme } from "@/lib/theme";

/**
 * Compact path filter for the header - the same GET ?path= search the
 * overview page's old PathFilterForm ran, without the extra row it cost.
 * Pressing "/" anywhere outside a form field focuses it (the placeholder's
 * "Q /" hint); submit is a native GET navigation, no fetch involved.
 */
export function HeaderSearch({ siteId, defaultValue }: { siteId: string; defaultValue?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <form method="GET" action="/" className="lantern-header-collapsible" style={{ margin: 0 }}>
      <input type="hidden" name="siteId" value={siteId} />
      <input
        ref={inputRef}
        type="text"
        name="path"
        defaultValue={defaultValue ?? ""}
        placeholder="Q /"
        aria-label="Filter by path"
        style={{
          height: 32,
          width: 112,
          background: theme.color.cardBg,
          border: `1px solid ${theme.color.fieldBorder}`,
          borderRadius: theme.radius.small,
          padding: "0 0.6rem",
          fontSize: "0.75rem",
          fontFamily: "inherit",
          color: theme.color.text,
        }}
      />
    </form>
  );
}
