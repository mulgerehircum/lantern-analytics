"use client";

import { useEffect, useState } from "react";
import { theme } from "@/lib/theme";

const STORAGE_KEY = "lantern-theme";

/**
 * SSR-safe-default-then-swap, same pattern as HourBar/LocalDateTime: the
 * server has no way to know the visitor's stored preference, so this
 * assumes "light" until mounted, then reads the real state from the DOM
 * (already set correctly pre-paint by layout.tsx's inline script) and syncs
 * to it - avoids a hydration mismatch without needing the server to guess.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.dataset.theme = "dark";
    } else {
      delete document.documentElement.dataset.theme;
    }
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Private browsing / storage disabled - the toggle still works for this page load, just doesn't persist.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      style={{
        display: "block",
        marginTop: "0.8rem",
        background: "none",
        border: "none",
        padding: 0,
        fontSize: "0.8rem",
        color: theme.color.textMuted,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {dark ? "☀ Light mode" : "☾ Dark mode"}
    </button>
  );
}
