"use client";

import { useEffect, useState } from "react";
import { theme, card } from "@/lib/theme";
import type { HeatmapPoint } from "@/lib/heatmap";
import { buildHeatmapGrid } from "@/lib/heatmap";
import { HeatmapGrid } from "./HeatmapGrid";

const DIMENSIONS_TIMEOUT_MS = 2000;
/** Defensive DOM-node bound, same spirit as the Events page's MAX_OCCURRENCE_ROWS. */
const MAX_RENDERED_POINTS = 2000;

interface FrameDimensionsMessage {
  source: "lantern-tracker";
  type: "dimensions";
  width: number;
  height: number;
}

function isFrameDimensionsMessage(data: unknown): data is FrameDimensionsMessage {
  const record = data as Record<string, unknown> | null;
  return typeof record === "object" && record !== null && record.source === "lantern-tracker" && record.type === "dimensions";
}

/**
 * Live iframe of the tracked page with a click-density overlay on top.
 * Sizing the overlay correctly requires the embedded page's real pixel
 * height, which cross-origin JS can't read from the iframe directly — the
 * tracker's own frame-report.ts posts it via postMessage when it detects
 * it's embedded (opt-in via data-heatmap). If nothing arrives within
 * DIMENSIONS_TIMEOUT_MS — the target site hasn't opted in, hasn't shipped
 * the updated tracker yet, or its CSP/X-Frame-Options blocked the iframe
 * outright (browsers give no clean JS-visible signal for that last case) —
 * this falls back to the context-free density grid instead.
 */
export function HeatmapOverlay({ siteUrl, path, points }: { siteUrl: string; path: string; points: HeatmapPoint[] }) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    setDimensions(null);
    setBlocked(false);

    function onMessage(e: MessageEvent) {
      if (!isFrameDimensionsMessage(e.data)) return;
      setDimensions({ width: e.data.width, height: e.data.height });
    }
    window.addEventListener("message", onMessage);
    const timer = setTimeout(() => setBlocked(true), DIMENSIONS_TIMEOUT_MS);

    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
    };
  }, [siteUrl, path]);

  if (dimensions) {
    const shownPoints = points.slice(-MAX_RENDERED_POINTS);
    return (
      <div style={card}>
        <div style={{ maxHeight: 600, overflow: "auto", borderRadius: theme.radius.control, border: `1px solid ${theme.color.cardBorder}` }}>
          <div style={{ position: "relative", width: "100%", height: dimensions.height }}>
            <iframe
              src={`${siteUrl}${path}`}
              title={`Live preview of ${path}`}
              style={{ position: "absolute", inset: 0, width: "100%", height: dimensions.height, border: "none" }}
            />
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              {shownPoints.map((p, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${p.xPct}%`,
                    top: `${p.yPct}%`,
                    width: 26,
                    height: 26,
                    marginLeft: -13,
                    marginTop: -13,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${theme.color.brand} 0%, transparent 70%)`,
                    opacity: 0.35,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <p style={{ fontSize: "0.72rem", color: theme.color.textMuted, marginTop: "0.6rem", marginBottom: 0 }}>
          {points.length} click{points.length === 1 ? "" : "s"} recorded for {path} in the last ~30 days
        </p>
      </div>
    );
  }

  if (blocked) {
    return <HeatmapGrid grid={buildHeatmapGrid(points)} note="Live preview unavailable — showing density grid instead." />;
  }

  return <p style={{ color: theme.color.textFaint, fontSize: "0.82rem" }}>Loading live preview…</p>;
}
