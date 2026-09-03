import type { ReactNode } from "react";
import Link from "next/link";
import { theme } from "@/lib/theme";
import { Sidebar } from "./Sidebar";
import type { View } from "./Sidebar";
import { MobileNav } from "./MobileNav";

/**
 * Shared page shell: Sidebar + content area with a title/filter-chip header.
 * Assembled per-page (not in layout.tsx) since only page.tsx components can
 * read searchParams in the App Router - each page still does its own data
 * fetching, this just replaces the old hand-rolled <main>/<h1> boilerplate
 * that used to be duplicated across all four pages.
 */
export function AppShell({
  siteId,
  siteUrl,
  activeView,
  basePath,
  title,
  filterChip,
  children,
}: {
  siteId: string;
  siteUrl?: string;
  activeView: View;
  basePath: string;
  title: ReactNode;
  filterChip?: { label: string; value: string; clearHref: string };
  children: ReactNode;
}) {
  return (
    <div className="lantern-app-shell" style={{ display: "flex", minHeight: "100vh" }}>
      <MobileNav>
        <Sidebar siteId={siteId} siteUrl={siteUrl} activeView={activeView} basePath={basePath} />
      </MobileNav>
      <div style={{ flex: 1, padding: "2.5rem 2.5rem 4rem", minWidth: 0 }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: theme.font.weight.bold }}>{title}</h1>
          {filterChip && (
            <Link
              href={filterChip.clearHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                background: theme.color.brandTintBg,
                color: theme.color.brandTintText,
                fontSize: "0.78rem",
                fontWeight: theme.font.weight.semibold,
                padding: "0.35rem 0.7rem",
                borderRadius: theme.radius.pill,
                marginTop: "0.6rem",
                textDecoration: "none",
              }}
            >
              Filtered by {filterChip.label}: {filterChip.value} ✕
            </Link>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
