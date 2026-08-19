import type { CSSProperties } from "react";

/**
 * Design tokens for the "Olive Sidebar A2 / Main1" redesign (see the design
 * handoff README). Plain TS object, not a CSS-in-JS library — matches the
 * rest of the codebase's inline-`style={{}}` convention, just centralizing
 * the values that used to be one-off hex literals scattered per file.
 */
export const theme = {
  color: {
    bg: "oklch(0.97 0.015 110)",
    sidebarBg: "oklch(0.94 0.03 110)",
    sidebarBorder: "oklch(0.89 0.02 110)",
    border: "oklch(0.89 0.02 110)",
    cardBorder: "oklch(0.95 0.01 110)",
    fieldBorder: "oklch(0.85 0.02 110)",
    underline: "oklch(0.78 0.02 110)",
    text: "oklch(0.28 0.03 110)",
    textMuted: "oklch(0.48 0.02 110)",
    textMutedLight: "oklch(0.55 0.02 110)",
    brand: "oklch(0.55 0.16 135)",
    brandTintBg: "oklch(0.91 0.04 135)",
    brandTintText: "oklch(0.3 0.05 135)",
    brandTintTextStrong: "oklch(0.5 0.16 135)",
    amber: "oklch(0.55 0.1 60)",
  },
  radius: {
    card: 14,
    control: 10,
    pill: 999,
    small: 6,
  },
  font: {
    family: "'Figtree', system-ui, sans-serif",
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  },
} as const;

/** Shared white-card shell reused by every card in the new layout. */
export const card: CSSProperties = {
  background: "#fff",
  borderRadius: theme.radius.card,
  padding: "1.2rem 1.4rem",
};
