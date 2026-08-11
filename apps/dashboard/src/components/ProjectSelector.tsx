import { SITES } from "@/lib/sites";

/** Shared inline-style constant for form fields — used by ProjectSelector,
 * page.tsx's FilterBar, and the sessions pages, keeping their controls
 * visually consistent without a component library (see docs/design.md). */
export const fieldStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: "0.85rem",
};

/**
 * Project selector — a plain GET form, no client JS. Submitting navigates to
 * `${basePath}?siteId=<id>`, clearing any other query params: switching
 * projects is a "start fresh here" action (see page.tsx's original comment on
 * this same behavior). `basePath` lets the sessions pages reuse this control
 * while landing back on `/sessions` instead of `/`.
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
    <form
      method="GET"
      action={basePath}
      style={{
        display: "flex",
        gap: "0.5rem",
        alignItems: "flex-end",
        flexWrap: "wrap",
        marginBottom: "0.5rem",
      }}
    >
      <label style={{ fontSize: "0.75rem", color: "#555" }}>
        Project
        <br />
        <select name="siteId" defaultValue={siteId} style={fieldStyle}>
          {SITES.map((s) => (
            <option key={s.siteId} value={s.siteId}>
              {s.name}
            </option>
          ))}
          {!SITES.some((s) => s.siteId === siteId) && <option value={siteId}>{siteId} (unregistered)</option>}
        </select>
      </label>
      <button type="submit" style={{ ...fieldStyle, cursor: "pointer", background: "#4f46e5", color: "#fff", border: "none" }}>
        Open
      </button>
      {siteUrl && (
        <a href={siteUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.85rem", color: "#4f46e5" }}>
          {siteUrl}
        </a>
      )}
    </form>
  );
}
