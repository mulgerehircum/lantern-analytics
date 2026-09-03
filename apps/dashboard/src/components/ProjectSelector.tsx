import { SITES } from "@/lib/sites";
import { theme } from "@/lib/theme";

/** Shared inline-style constant for form fields - used by ProjectSelector
 * and the sessions pages' VariantFilterForm, keeping their controls visually
 * consistent without a component library (see docs/design.md). */
export const fieldStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: theme.radius.small,
  border: `1px solid ${theme.color.fieldBorder}`,
  fontSize: "0.85rem",
};

/**
 * Project selector - a plain GET form, no client JS. Submitting navigates to
 * `${basePath}?siteId=<id>`, clearing any other query params: switching
 * projects is a "start fresh here" action (see page.tsx's original comment on
 * this same behavior). `basePath` lets the sessions pages reuse this control
 * while landing back on `/sessions` instead of `/`.
 *
 * The design mockup's sidebar site-picker shows no separate submit control
 * (implying a live-onChange interaction) - this app has no client JS on this
 * form, so a real submit button has to stay visible. Shrunk to a small arrow
 * icon-button to fit the sidebar's visual weight rather than dropped
 * entirely - a deliberate, documented fidelity deviation.
 */
export function ProjectSelector({
  siteId,
  siteUrl,
  basePath = "/",
}: {
  siteId: string;
  siteUrl?: string;
  basePath?: string;
}) {
  return (
    <form method="GET" action={basePath} style={{ marginBottom: "1.6rem" }}>
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <select
          name="siteId"
          defaultValue={siteId}
          style={{
            width: "100%",
            border: `1px solid ${theme.color.fieldBorder}`,
            borderRadius: theme.radius.control,
            padding: "8px 10px",
            fontSize: "0.85rem",
            fontFamily: "inherit",
            background: theme.color.cardBg,
            boxSizing: "border-box",
          }}
        >
          {SITES.map((s) => (
            <option key={s.siteId} value={s.siteId}>
              {s.name}
            </option>
          ))}
          {!SITES.some((s) => s.siteId === siteId) && <option value={siteId}>{siteId} (unregistered)</option>}
        </select>
        <button
          type="submit"
          aria-label="Switch project"
          title="Switch project"
          style={{
            flexShrink: 0,
            width: 34,
            border: "none",
            borderRadius: theme.radius.control,
            background: theme.color.brand,
            color: theme.color.onBrand,
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          →
        </button>
      </div>
      {siteUrl && (
        <a href={siteUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.72rem", color: theme.color.brand, display: "block", marginTop: "0.4rem" }}>
          {siteUrl}
        </a>
      )}
    </form>
  );
}
