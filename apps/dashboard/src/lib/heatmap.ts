import { HEATMAP_CLICK_EVENT_NAME } from "@lantern/shared";
import type { RawEventRecordWithKey } from "./dynamodb";

export interface HeatmapPoint {
  xPct: number;
  yPct: number;
}

/** Reads lantern_heatmap_click events for one path; drops anything with malformed/missing coordinates. */
export function extractHeatmapClicks(events: RawEventRecordWithKey[], path: string): HeatmapPoint[] {
  const points: HeatmapPoint[] = [];
  for (const event of events) {
    if (event.name !== HEATMAP_CLICK_EVENT_NAME || event.path !== path) continue;
    const xPct = Number(event.metadata?.xPct);
    const yPct = Number(event.metadata?.yPct);
    if (!Number.isFinite(xPct) || !Number.isFinite(yPct)) continue;
    points.push({ xPct, yPct });
  }
  return points;
}

export interface HeatmapGrid {
  cols: number;
  rows: number;
  counts: number[][];
  maxCount: number;
}

/** Buckets points into a cols x rows grid - the fallback renderer when the live iframe overlay can't be used. */
export function buildHeatmapGrid(points: HeatmapPoint[], cols = 20, rows = 20): HeatmapGrid {
  const counts: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0) as number[]);
  let maxCount = 0;

  for (const point of points) {
    const col = Math.min(cols - 1, Math.max(0, Math.floor((point.xPct / 100) * cols)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor((point.yPct / 100) * rows)));
    counts[row][col] += 1;
    maxCount = Math.max(maxCount, counts[row][col]);
  }

  return { cols, rows, counts, maxCount };
}
