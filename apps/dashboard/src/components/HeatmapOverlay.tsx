"use client";

import { useEffect, useRef, useState } from "react";
import { theme, card } from "@/lib/theme";
import type { HeatmapPoint } from "@/lib/heatmap";
import { buildHeatmapGrid } from "@/lib/heatmap";
import { HeatmapGrid } from "./HeatmapGrid";

const DIMENSIONS_TIMEOUT_MS = 8000;
/** Defensive DOM-node bound, same spirit as the Events page's MAX_OCCURRENCE_ROWS. */
const MAX_RENDERED_POINTS = 2000;

/**
 * Render the tracked page at a fixed "desktop" width, then visually scale it
 * down to fit whatever width this card actually has — not the card's real
 * width directly. Sites are responsive: a narrow iframe (e.g. this card's
 * column inside the dashboard's layout) makes them reflow into a cramped,
 * squeezed-looking layout that isn't representative of how the page really
 * looks, and isn't what a click-density heatmap should be measured against
 * anyway (clicks were recorded from real visitors on real desktop/mobile
 * viewports, not "whatever width this card happens to be").
 *
 * Only ever scales DOWN, never up: on a normal-width browser this card's
 * column is very likely wider than MIN_DESKTOP_WIDTH, and scaling the
 * iframe up past its real size just to fill that extra space would render
 * the page zoomed in beyond how it actually looks — worse than a bit of
 * empty margin on the sides.
 */
const MIN_DESKTOP_WIDTH = 1280;

interface FrameDimensionsMessage {
  source: "lantern-tracker";
  type: "dimensions";
  width: number;
  height: number;
}

/**
 * Real page heights, measured directly (not through the tracker) across a
 * few realistic widths, topped out around 6100px — so 10000 leaves real
 * headroom for a genuinely long page while still catching the kind of wild
 * outlier that showed up in practice (tens of millions of pixels from a
 * transient bad measurement).
 */
const MAX_SANE_DIMENSION = 10000;

function isFrameDimensionsMessage(data: unknown): data is FrameDimensionsMessage {
  const record = data as Record<string, unknown> | null;
  if (typeof record !== "object" || record === null || record.source !== "lantern-tracker" || record.type !== "dimensions") return false;
  const { width, height } = record;
  return (
    typeof width === "number" &&
    typeof height === "number" &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0 &&
    width <= MAX_SANE_DIMENSION &&
    height <= MAX_SANE_DIMENSION
  );
}

const FALLBACK_HEIGHT = 800;

/**
 * Live iframe of the tracked page with a click-density overlay on top.
 * Sizing the overlay correctly requires the embedded page's real pixel
 * height, which cross-origin JS can't read from the iframe directly — the
 * tracker's own frame-report.ts posts it via postMessage when it detects
 * it's embedded (opt-in via data-heatmap).
 *
 * The iframe itself must mount unconditionally, before any dimensions
 * message exists — otherwise the embedded page never gets a chance to load
 * and report back, so no message could ever arrive (an earlier version of
 * this component gated the iframe's very existence on `dimensions` already
 * being set, which meant it could never receive the message that sets it).
 * Only the overlay dots and exact height wait on `dimensions`; the iframe
 * renders at a reasonable fallback height in the meantime.
 *
 * If nothing arrives within DIMENSIONS_TIMEOUT_MS — the target site hasn't
 * opted in, hasn't shipped the updated tracker yet, or its CSP/X-Frame-Options
 * blocked the iframe outright (browsers give no clean JS-visible signal for
 * that last case) — this falls back to the context-free density grid instead.
 */
export function HeatmapOverlay({ siteUrl, path, points }: { siteUrl: string; path: string; points: HeatmapPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(MIN_DESKTOP_WIDTH);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  if (blocked && !dimensions) {
    return <HeatmapGrid grid={buildHeatmapGrid(points)} note="Live preview unavailable — showing density grid instead." />;
  }

  const shownPoints = points.slice(-MAX_RENDERED_POINTS);
  const contentHeight = 1080;
  // Never render the iframe narrower than MIN_DESKTOP_WIDTH (avoids the
  // squeeze bug), but never scale it up past 1:1 either (avoids the zoom
  // bug) — effectiveWidth just grows to match a wider container instead.
  const effectiveWidth = Math.max(containerWidth, MIN_DESKTOP_WIDTH);
  const scale = containerWidth / effectiveWidth;
  const scaledHeight = contentHeight * scale;

  return (
    <div style={card}>
      <div ref={containerRef} style={{ maxHeight: "80vh", overflow: "auto", borderRadius: theme.radius.control, border: `1px solid ${theme.color.cardBorder}` }}>
        <div style={{ position: "relative", width: "100%", height: scaledHeight }}>
          <div style={{ position: "absolute", top: 0, left: 0, width: effectiveWidth, height: contentHeight, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <iframe
              src={`${siteUrl}${path}`}
              title={`Live preview of ${path}`}
              style={{ width: effectiveWidth, height: contentHeight, border: "none" }}
            />
          </div>
          {dimensions && (
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
          )}
        </div>
      </div>
      <p style={{ fontSize: "0.72rem", color: theme.color.textMuted, marginTop: "0.6rem", marginBottom: 0 }}>
        {points.length} click{points.length === 1 ? "" : "s"} recorded for {path} in the last ~30 days
      </p>
    </div>
  );
}
