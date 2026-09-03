import type { ReactNode } from "react";
import { theme } from "@/lib/theme";

export const metadata = {
  title: "Lantern Analytics",
  description: "Privacy-first web analytics",
};

/**
 * First real global stylesheet in the app - needed because inline styles
 * (used everywhere else) beat any CSS rule by specificity, so a media query
 * genuinely can't be expressed inline (the same lesson learned the hard way
 * with <details> defeating a native-collapse attempt during the redesign).
 * Kept to exactly what a media query/custom-property definition requires;
 * everything else stays inline, reading these variables via theme.ts.
 *
 * Dark values keep each token's hue/chroma close to its light counterpart
 * and invert the lightness axis. Borders get MORE separation from their
 * background in dark mode than light (a real oklch dark-mode readability
 * point, not an oversight - dark-on-dark contrast reads flatter to the eye
 * than the equivalent light-mode delta). cardBg sits slightly lighter than
 * bg so cards stay visually distinct the way white-on-oklch(0.97) does
 * today, not because it's "the same as bg".
 */
const globalStyles = `
  :root {
    --color-bg: oklch(0.97 0.015 110);
    --color-sidebar-bg: oklch(0.94 0.03 110);
    --color-sidebar-border: oklch(0.89 0.02 110);
    --color-border: oklch(0.89 0.02 110);
    --color-card-border: oklch(0.95 0.01 110);
    --color-field-border: oklch(0.85 0.02 110);
    --color-underline: oklch(0.78 0.02 110);
    --color-text: oklch(0.28 0.03 110);
    --color-text-muted: oklch(0.48 0.02 110);
    --color-text-muted-light: oklch(0.55 0.02 110);
    --color-text-faint: oklch(0.64 0.01 110);
    --color-brand: oklch(0.55 0.16 135);
    --color-brand-tint-bg: oklch(0.91 0.04 135);
    --color-brand-tint-text: oklch(0.3 0.05 135);
    --color-brand-tint-text-strong: oklch(0.5 0.16 135);
    --color-amber: oklch(0.55 0.1 60);
    --color-danger: oklch(0.55 0.1 60);
    --color-card-bg: oklch(1 0 0);
    --color-on-brand: oklch(1 0 0);
  }
  [data-theme="dark"] {
    --color-bg: oklch(0.19 0.015 110);
    --color-sidebar-bg: oklch(0.16 0.02 110);
    --color-sidebar-border: oklch(0.28 0.02 110);
    --color-border: oklch(0.28 0.02 110);
    --color-card-border: oklch(0.32 0.01 110);
    --color-field-border: oklch(0.35 0.02 110);
    --color-underline: oklch(0.4 0.02 110);
    --color-text: oklch(0.92 0.01 110);
    --color-text-muted: oklch(0.68 0.015 110);
    --color-text-muted-light: oklch(0.6 0.015 110);
    --color-text-faint: oklch(0.5 0.01 110);
    --color-brand: oklch(0.62 0.16 135);
    --color-brand-tint-bg: oklch(0.28 0.06 135);
    --color-brand-tint-text: oklch(0.85 0.08 135);
    --color-brand-tint-text-strong: oklch(0.75 0.16 135);
    --color-amber: oklch(0.68 0.12 60);
    --color-danger: oklch(0.68 0.12 60);
    --color-card-bg: oklch(0.22 0.015 110);
    --color-on-brand: oklch(1 0 0);
  }
  .lantern-hamburger { display: none; }
  /* Column counts live here, not inline, specifically so the mobile
     override below can actually take effect - an inline gridTemplateColumns
     would always beat a stylesheet rule regardless of media query. */
  .lantern-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
  .lantern-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
  .lantern-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
  @media (max-width: 768px) {
    .lantern-grid-4, .lantern-grid-3, .lantern-grid-2 {
      grid-template-columns: 1fr;
    }
    /* Header bar: search + Live View collapse away so Export CSV and the
       project title keep immediate visibility; the date pill and stepper
       stay (they wrap onto their own row via the bar's flex-wrap). */
    .lantern-header-collapsible {
      display: none;
    }
    .lantern-hamburger {
      display: flex;
      align-items: center;
      justify-content: center;
      position: fixed;
      top: 1rem;
      left: 1rem;
      z-index: 50;
      width: 40px;
      height: 40px;
      border-radius: ${theme.radius.control}px;
      border: none;
      background: ${theme.color.brand};
      color: ${theme.color.onBrand};
      font-size: 1.1rem;
      cursor: pointer;
    }
    /* left is set via inline style (MobileNav.tsx), driven directly by React
       state, not by toggling this class - sidesteps a transform/compositing
       issue where translateX-based sliding wasn't reliably taking effect.
       left-based animation costs a layout pass instead of being purely
       compositor-driven, but for a single occasional drawer open/close
       that's an irrelevant tradeoff, and it's unambiguous to verify (real
       layout position, not just a paint-time offset). */
    .lantern-sidebar-wrap {
      position: fixed;
      top: 0;
      height: 100vh;
      z-index: 40;
      transition: left 0.2s ease-out;
    }
    .lantern-mobile-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 30;
    }
  }
`;

/**
 * Sets data-theme on <html> synchronously, before first paint - the
 * standard flash-of-wrong-theme fix. Must run as a plain blocking script,
 * not next/script (any deferred strategy runs after paint, too late). This
 * is the dashboard OPERATOR's own UI preference for a private,
 * single-operator tool - unrelated to and not in tension with the
 * tracker's (packages/tracker) no-cookies/no-visitor-identity stance,
 * which governs the tracking script running on end-user-visited sites, a
 * completely different application with a completely different audience.
 */
const themeInitScript = `
  try {
    if (localStorage.getItem("lantern-theme") === "dark") {
      document.documentElement.dataset.theme = "dark";
    }
  } catch (e) {}
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  // suppressHydrationWarning is scoped to this element's own attributes only
  // (not descendants) - needed because themeInitScript below sets data-theme
  // on this exact tag before React hydrates, which would otherwise be
  // (correctly, but harmlessly) flagged as a server/client mismatch every
  // time dark mode is active.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{globalStyles}</style>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body style={{ margin: 0, background: theme.color.bg, fontFamily: theme.font.family, color: theme.color.text }}>
        {children}
      </body>
    </html>
  );
}
