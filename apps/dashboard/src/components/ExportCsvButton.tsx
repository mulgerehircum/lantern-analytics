"use client";

import { theme } from "@/lib/theme";

/**
 * Stateless - the CSV string is built server-side (DataTableCard already has
 * the row data; no need to ship it twice or duplicate escaping logic in the
 * client) and handed here as a plain string, safe to cross the server/client
 * boundary since it's just data, not a function.
 */
export function ExportCsvButton({
  csv,
  filename,
  variant = "link",
}: {
  csv: string;
  filename: string;
  /** "link" keeps the quiet per-table action; "primary" is the header's brand-filled Export CSV button. */
  variant?: "link" | "primary";
}) {
  const handleClick = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (variant === "primary") {
    return (
      <button
        type="button"
        onClick={handleClick}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
          height: 32,
          padding: "0 0.75rem",
          background: theme.color.brand,
          color: theme.color.onBrand,
          border: "none",
          borderRadius: theme.radius.small,
          fontSize: "0.75rem",
          fontWeight: theme.font.weight.medium,
          cursor: "pointer",
        }}
      >
        <span aria-hidden>↓</span>
        <span>Export CSV</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        fontSize: "0.72rem",
        fontWeight: theme.font.weight.medium,
        color: theme.color.brand,
        cursor: "pointer",
      }}
    >
      Export CSV
    </button>
  );
}
