import { theme } from "@/lib/theme";
import { ProjectSelector } from "./ProjectSelector";

export type View = "overview" | "pages" | "sources" | "events" | "sessions" | "experiments";

/**
 * The dashboard's persistent left shell — logo, real site switcher, nav, and
 * a decorative "Filters" section (per the design handoff: those fields are
 * NOT wired to lib/filter.ts in this pass; real filtering happens via the
 * data-table row clicks and the "Path contains…" fallback input on Overview).
 * Server Component, no client JS — same convention as the rest of the app.
 */
export function Sidebar({
  siteId,
  siteUrl,
  activeView,
  basePath,
}: {
  siteId: string;
  siteUrl?: string;
  activeView: View;
  basePath: string;
}) {
  const qs = `?siteId=${encodeURIComponent(siteId)}`;

  return (
    <aside
      style={{
        width: 250,
        flexShrink: 0,
        background: theme.color.sidebarBg,
        padding: "1.8rem 1.2rem",
        minHeight: "100vh",
        boxSizing: "border-box",
        borderRight: `1px solid ${theme.color.sidebarBorder}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.6rem" }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: theme.radius.control,
            background: theme.color.brand,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: theme.font.weight.bold,
          }}
        >
          L
        </div>
        <div style={{ fontWeight: theme.font.weight.bold, fontSize: "0.95rem" }}>Lantern</div>
      </div>

      <ProjectSelector siteId={siteId} siteUrl={siteUrl} basePath={basePath} />

      <nav style={{ display: "flex", flexDirection: "column", gap: "0.15rem", margin: "1.2rem 0 1.6rem" }}>
        <NavLink label="Overview" href={`/${qs}`} active={activeView === "overview"} />
        <NavLink label="Pages" href={`/pages${qs}`} active={activeView === "pages"} />
        <NavLink label="Sources" href={`/sources${qs}`} active={activeView === "sources"} />
        <NavLink label="Events" href={`/events${qs}`} active={activeView === "events"} />
        <NavLink label="Sessions" href={`/sessions${qs}`} active={activeView === "sessions"} />
        <NavLink label="Experiments" href={`/experiments${qs}`} active={activeView === "experiments"} />
      </nav>

      <div style={{ height: 1, background: theme.color.sidebarBorder, marginBottom: "1.4rem" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.9rem" }}>
        <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: theme.color.textMutedLight }}>
          Filters
        </div>
        <span style={{ fontSize: "0.72rem", color: theme.color.brand }}>Clear</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <DecorativeField label="Path">
          <input type="text" placeholder="/any" style={underlineFieldStyle} disabled />
        </DecorativeField>
        <DecorativeField label="Referrer">
          <select style={underlineFieldStyle} disabled>
            <option>All</option>
          </select>
        </DecorativeField>
        <DecorativeField label="Country">
          <select style={underlineFieldStyle} disabled>
            <option>All</option>
          </select>
        </DecorativeField>
        <DecorativeField label="Device">
          <select style={underlineFieldStyle} disabled>
            <option>All</option>
          </select>
        </DecorativeField>
        <DecorativeField label="Event">
          <select style={underlineFieldStyle} disabled>
            <option>All</option>
          </select>
        </DecorativeField>
      </div>

      <div style={{ flex: 1 }} />
      {siteUrl && (
        <a
          href={siteUrl}
          target="_blank"
          rel="noreferrer"
          style={{ display: "block", marginTop: "1.6rem", fontSize: "0.8rem", color: theme.color.brand, textDecoration: "none", fontWeight: theme.font.weight.semibold }}
        >
          View live site ↗
        </a>
      )}
    </aside>
  );
}

function NavLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <a
      href={href}
      style={{
        padding: "0.55rem 0.7rem 0.55rem 0.9rem",
        fontSize: "0.85rem",
        textDecoration: "none",
        borderLeft: active ? `3px solid ${theme.color.brand}` : "3px solid transparent",
        background: active ? theme.color.brandTintBg : "transparent",
        color: active ? theme.color.brandTintText : theme.color.textMuted,
        fontWeight: active ? theme.font.weight.semibold : theme.font.weight.regular,
      }}
    >
      {label}
    </a>
  );
}

function DecorativeField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ fontSize: "0.78rem", color: theme.color.textMuted, display: "block" }}>
      {label}
      <br />
      {children}
    </label>
  );
}

const underlineFieldStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  border: "none",
  borderBottom: `1px solid ${theme.color.underline}`,
  borderRadius: 0,
  padding: "5px 2px",
  fontSize: "0.82rem",
  fontFamily: "inherit",
  marginTop: 4,
  boxSizing: "border-box",
  background: "none",
  color: theme.color.textMuted,
};
