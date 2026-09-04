import { theme, card } from "@/lib/theme";

/**
 * Route-level loading skeleton (instant nav feedback while the Server
 * Component's DynamoDB reads resolve). One shared skeleton rather than
 * per-route ones: every view is the same card-grid shape, and a loading
 * file that approximates the real layout is what avoids the
 * layout-shift jank - precise per-page skeletons would just churn.
 * Plain non-interactive divs, no client JS.
 */
export default function Loading() {
  return (
    <div className="lantern-app-shell" style={{ display: "flex", minHeight: "100vh" }}>
      {/* Slight right padding imbalance mirrors the real sidebar width so
          the content column lands where the loaded page will. */}
      <div style={{ width: 230, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, padding: "1.5rem 1.5rem 3rem" }}>
        <div style={{ ...card, height: "4.2rem", marginBottom: "1.5rem" }} />
        <div style={{ ...card, height: "8.5rem", marginBottom: "1.25rem" }} />
        <div className="lantern-grid-2" style={{ display: "grid", gap: "1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ ...card, height: "12rem" }} />
          <div style={{ ...card, height: "12rem" }} />
        </div>
        <div style={{ ...card, height: "16rem" }} />
      </div>
    </div>
  );
}
