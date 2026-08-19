import type { CSSProperties } from "react";

/**
 * Design tokens for the "Olive Sidebar A2 / Main1" redesign (see the design
 * handoff README). Every color is a `var(--color-*)` reference, not a
 * literal — the actual light/dark values live in the <style> block in
 * layout.tsx (see ThemeToggle.tsx for how the active theme is chosen/
 * persisted). Consumers are unaffected by this indirection: `theme.color.X`
 * still returns one string, just resolved by the browser at paint time
 * instead of baked in here.
 */
export const theme = {
  color: {
    bg: "var(--color-bg)",
    sidebarBg: "var(--color-sidebar-bg)",
    sidebarBorder: "var(--color-sidebar-border)",
    border: "var(--color-border)",
    cardBorder: "var(--color-card-border)",
    fieldBorder: "var(--color-field-border)",
    underline: "var(--color-underline)",
    text: "var(--color-text)",
    textMuted: "var(--color-text-muted)",
    textMutedLight: "var(--color-text-muted-light)",
    /** Most washed-out text tier — "No data yet"/"No matches" empty states. */
    textFaint: "var(--color-text-faint)",
    brand: "var(--color-brand)",
    brandTintBg: "var(--color-brand-tint-bg)",
    brandTintText: "var(--color-brand-tint-text)",
    brandTintTextStrong: "var(--color-brand-tint-text-strong)",
    amber: "var(--color-amber)",
    /** Error states (e.g. ReplayPlayer's "Failed to load the recording"). */
    danger: "var(--color-danger)",
    /** White-card background — a named token rather than a bare "#fff" so dark mode has somewhere to redefine it. */
    cardBg: "var(--color-card-bg)",
    /** Text/icon color for content sitting on a brand-colored background (buttons, the logo badge). */
    onBrand: "var(--color-on-brand)",
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

/** Shared card shell reused by every card in the new layout. */
export const card: CSSProperties = {
  background: theme.color.cardBg,
  borderRadius: theme.radius.card,
  padding: "1.2rem 1.4rem",
};
