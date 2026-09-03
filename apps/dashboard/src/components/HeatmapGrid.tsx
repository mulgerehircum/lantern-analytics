import { theme, card } from "@/lib/theme";
import type { HeatmapGrid as HeatmapGridData } from "@/lib/heatmap";

/**
 * Context-free density grid - no page content, just relative click
 * concentration. Renders whenever there's no data yet, and as the fallback
 * when HeatmapOverlay's live iframe can't be confirmed (see that
 * component's doc comment).
 */
export function HeatmapGrid({ grid, note }: { grid: HeatmapGridData; note?: string }) {
  return (
    <div style={card}>
      {note && <p style={{ color: theme.color.textFaint, fontSize: "0.78rem", margin: "0 0 0.8rem" }}>{note}</p>}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
          gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
          aspectRatio: `${grid.cols} / ${grid.rows}`,
          gap: 1,
          background: theme.color.cardBorder,
        }}
      >
        {grid.counts.map((row, r) =>
          row.map((count, c) => (
            <div
              key={`${r}-${c}`}
              style={{
                background: theme.color.brand,
                opacity: grid.maxCount > 0 ? (count / grid.maxCount) * 0.85 : 0,
              }}
            />
          )),
        )}
      </div>
    </div>
  );
}
