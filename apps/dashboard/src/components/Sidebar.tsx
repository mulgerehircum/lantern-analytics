import Link from "next/link";
import { theme } from "@/lib/theme";
import { FUNNELS_ENABLED, HEATMAPS_ENABLED } from "@/lib/flags";
import { HeaderProjectSwitcher } from "./HeaderProjectSwitcher";
import { ThemeToggle } from "./ThemeToggle";

export type View = "overview" | "pages" | "sources" | "events" | "sessions" | "experiments" | "funnels" | "heatmaps";

/**
 * Persistent left shell - logo, project pill, icon nav, active filters,
 * workspace row. Server Component, no client JS of its own (project
 * switching is the HeaderProjectSwitcher island; theme is ThemeToggle).
 */
export function Sidebar({
  siteId,
  siteUrl,
  activeView,
  basePath,
  liveCount,
  activeFilter,
}: {
  siteId: string;
  siteUrl?: string;
  activeView: View;
  basePath: string;
  /** Current-hour live events - shows the Overview "Live" badge when > 0. */
  liveCount?: number;
  /** The overview page's real dimension filter, if one is active. */
  activeFilter?: { label: string; value: string; clearHref: string };
}) {
  const qs = `?siteId=${encodeURIComponent(siteId)}`;
  const host = siteUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <aside
      style={{
        width: 256,
        flexShrink: 0,
        background: theme.color.sidebarBg,
        borderRight: `1px solid ${theme.color.sidebarBorder}`,
        display: "flex",
        flexDirection: "column",
        // sticky + height (not minHeight) pins the sidebar to the viewport as
        // the page scrolls. overflowY lets its own content scroll
        // independently if it ever exceeds one viewport.
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
        boxSizing: "border-box",
        userSelect: "none",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
        <div
          style={{
            padding: "1rem",
            paddingBottom: "0.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${theme.color.sidebarBorder}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: theme.radius.control,
                background: theme.color.brand,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: theme.color.onBrand,
                fontWeight: theme.font.weight.bold,
                fontSize: "1rem",
              }}
            >
              L
            </div>
            <div>
              <div style={{ fontWeight: theme.font.weight.bold, fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                Lantern
                <span
                  style={{
                    fontSize: "0.625rem",
                    padding: "0.125rem 0.375rem",
                    borderRadius: theme.radius.small,
                    fontWeight: theme.font.weight.semibold,
                    background: theme.color.brandTintBg,
                    color: theme.color.brandTintTextStrong,
                    border: `1px solid ${theme.color.sidebarBorder}`,
                  }}
                >
                  PRO
                </span>
              </div>
              <div style={{ fontSize: "0.6875rem", color: theme.color.textMuted, fontWeight: theme.font.weight.medium }}>
                Web Analytics
              </div>
            </div>
          </div>
          <span title="Settings" style={{ color: theme.color.textFaint, padding: "0.25rem", fontSize: "0.75rem" }}>
            <i className="fa-solid fa-gear" />
          </span>
        </div>

        <div style={{ padding: "0.75rem", borderBottom: `1px solid ${theme.color.sidebarBorder}` }}>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: theme.color.cardBg,
              padding: "0.5rem 0.75rem",
              borderRadius: theme.radius.control,
              border: `1px solid ${theme.color.border}`,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0, flex: 1 }}>
              <span className="lantern-ping" style={{ width: 8, height: 8, borderRadius: "50%", background: theme.color.brand, display: "inline-block", flexShrink: 0 }} />
              <HeaderProjectSwitcher siteId={siteId} />
            </span>
          </div>
          {siteUrl && (
            <a
              href={siteUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                marginTop: "0.5rem",
                fontSize: "0.6875rem",
                color: theme.color.textMuted,
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0 0.25rem",
                textDecoration: "none",
              }}
            >
              <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: "0.625rem", color: theme.color.textFaint }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "underline", textUnderlineOffset: 2, textDecorationColor: theme.color.underline }}>
                {host}
              </span>
            </a>
          )}
        </div>

        <nav aria-label="Main Navigation" style={{ padding: "0.75rem" }}>
          <div style={{ padding: "0 0.5rem 0.375rem", fontSize: "0.625rem", fontWeight: theme.font.weight.bold, letterSpacing: "0.06em", textTransform: "uppercase", color: theme.color.textFaint }}>
            Analytics
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <NavLink label="Overview" href={`/${qs}`} icon="fa-chart-line" active={activeView === "overview"} badge={liveCount && liveCount > 0 ? "Live" : undefined} />
            <NavLink label="Pages" href={`/pages${qs}`} icon="fa-file-lines" iconRegular active={activeView === "pages"} />
            <NavLink label="Sources" href={`/sources${qs}`} icon="fa-bullseye" active={activeView === "sources"} />
            <NavLink label="Events" href={`/events${qs}`} icon="fa-bolt" active={activeView === "events"} />
            <NavLink label="Sessions" href={`/sessions${qs}`} icon="fa-user-group" active={activeView === "sessions"} />
          </div>
          <div style={{ padding: "0.75rem 0.5rem 0.375rem", fontSize: "0.625rem", fontWeight: theme.font.weight.bold, letterSpacing: "0.06em", textTransform: "uppercase", color: theme.color.textFaint }}>
            Insights & Labs
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <NavLink label="Experiments" href={`/experiments${qs}`} icon="fa-flask-vial" active={activeView === "experiments"} />
            {FUNNELS_ENABLED && <NavLink label="Funnels" href={`/funnels${qs}`} icon="fa-filter-circle-dollar" active={activeView === "funnels"} />}
            {HEATMAPS_ENABLED && <NavLink label="Heatmaps" href={`/heatmaps${qs}`} icon="fa-fire" active={activeView === "heatmaps"} />}
          </div>
        </nav>

        <div style={{ padding: "0.75rem", marginTop: "auto", borderTop: `1px solid ${theme.color.sidebarBorder}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0.5rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.625rem", fontWeight: theme.font.weight.bold, letterSpacing: "0.06em", textTransform: "uppercase", color: theme.color.textFaint }}>
              Active Filters
            </span>
            {activeFilter && (
              <Link href={activeFilter.clearHref} style={{ fontSize: "0.625rem", fontWeight: theme.font.weight.medium, color: theme.color.brand, textDecoration: "none" }}>
                Reset
              </Link>
            )}
          </div>
          {activeFilter ? (
            <div style={{ background: theme.color.cardBg, padding: "0.5rem", borderRadius: theme.radius.small, border: `1px solid ${theme.color.cardBorder}` }}>
              <div style={{ fontSize: "0.625rem", color: theme.color.textMuted, fontWeight: theme.font.weight.medium }}>{activeFilter.label}</div>
              <div style={{ fontSize: "0.75rem", fontFamily: theme.font.mono, color: theme.color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: theme.font.weight.semibold }}>
                {activeFilter.value}
              </div>
            </div>
          ) : (
            <div style={{ padding: "0 0.5rem", fontSize: "0.72rem", color: theme.color.textFaint }}>None</div>
          )}
        </div>

        <div
          style={{
            padding: "0.75rem",
            borderTop: `1px solid ${theme.color.sidebarBorder}`,
            background: theme.color.sidebarBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: theme.color.text,
                color: theme.color.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: theme.font.weight.bold,
                fontFamily: theme.font.mono,
              }}
            >
              N
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: "0.75rem", fontWeight: theme.font.weight.semibold, color: theme.color.text }}>Workspace</div>
              <div style={{ fontSize: "0.625rem", color: theme.color.textFaint }}>Free Tier</div>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

function NavLink({
  label,
  href,
  icon,
  iconRegular,
  active,
  badge,
}: {
  label: string;
  href: string;
  icon: string;
  iconRegular?: boolean;
  active: boolean;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.625rem",
        padding: "0.5rem 0.75rem",
        borderRadius: theme.radius.control,
        fontSize: "0.75rem",
        fontWeight: active ? theme.font.weight.semibold : theme.font.weight.medium,
        background: active ? theme.color.brandTintBg : "transparent",
        color: active ? theme.color.brandTintTextStrong : theme.color.textMuted,
        border: active ? `1px solid ${theme.color.sidebarBorder}` : "1px solid transparent",
        textDecoration: "none",
      }}
    >
      <i className={`${iconRegular ? "fa-regular" : "fa-solid"} ${icon}`} style={{ width: 16, textAlign: "center", color: active ? theme.color.brand : theme.color.textFaint, fontSize: "0.8rem" }} />
      <span>{label}</span>
      {badge && (
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.625rem",
            background: theme.color.brand,
            color: theme.color.onBrand,
            fontWeight: theme.font.weight.bold,
            padding: "0.125rem 0.375rem",
            borderRadius: theme.radius.pill,
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
