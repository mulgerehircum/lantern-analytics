"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SITES } from "@/lib/sites";
import { theme } from "@/lib/theme";

/**
 * Project switcher trigger + menu. A native <select> can't match the pill
 * trigger's width or styling (it sizes to its own text and renders the
 * platform dropdown), so this is a small client island instead: a
 * full-width button opening a styled menu of plain GET links - switching
 * projects is a "start fresh here" full-page navigation, same as before.
 */
export function HeaderProjectSwitcher({ siteId }: { siteId: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open ]);

  const current = SITES.find((s) => s.siteId === siteId);
  const currentName = current ? current.name : `${siteId} (unregistered)`;

  // NOTE: this wrapper stays position:static on purpose - the open menu
  // positions itself against the pill container in Sidebar.tsx (which is
  // relative), so the menu spans the full pill width instead of just the
  // trigger text width. rootRef is still the outside-click boundary.
  return (
    <div ref={rootRef} style={{ minWidth: 0, flex: 1 }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Switch project"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          border: "none",
          background: "transparent",
          padding: 0,
          fontSize: "0.75rem",
          fontWeight: theme.font.weight.semibold,
          fontFamily: "inherit",
          color: theme.color.text,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName}</span>
        <i
          className="fa-solid fa-chevron-down"
          aria-hidden
          style={{
            fontSize: "0.625rem",
            color: theme.color.textFaint,
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 0.5rem)",
            left: 0,
            right: 0,
            background: theme.color.cardBg,
            border: `1px solid ${theme.color.border}`,
            borderRadius: theme.radius.control,
            padding: "0.25rem",
            zIndex: 60,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          }}
        >
          {SITES.map((s) => {
            const active = s.siteId === siteId;
            return (
              <Link
                key={s.siteId}
                href={`/?siteId=${encodeURIComponent(s.siteId)}`}
                role="menuitem"
                className="lantern-menu-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.45rem 0.6rem",
                  borderRadius: theme.radius.small,
                  fontSize: "0.75rem",
                  fontWeight: active ? theme.font.weight.semibold : theme.font.weight.regular,
                  color: active ? theme.color.brandTintTextStrong : theme.color.text,
                  // No inline background when inactive - the
                  // .lantern-menu-item:hover rule owns the hover state,
                  // and inline styles would beat it.
                  background: active ? theme.color.brandTintBg : undefined,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ width: 14, textAlign: "center", color: active ? theme.color.brand : "transparent", fontSize: "0.7rem" }}>
                  ✓
                </span>
                {s.name}
              </Link>
            );
          })}
          {!current && (
            <span style={{ display: "block", padding: "0.45rem 0.6rem", fontSize: "0.75rem", color: theme.color.textMuted }}>
              {siteId} (unregistered)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
