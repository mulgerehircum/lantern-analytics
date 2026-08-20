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

/**
 * Fixed simulated viewport height for the iframe — deliberately NOT derived
 * from the tracked page's own measured content height. That was tried and
 * broke: this portfolio's Hero section uses `min-height: 100vh`, so the
 * page's own total height depends on whatever `100vh` resolves to *inside
 * the iframe* — which is the iframe's own box height. Feed a measured
 * height back into that box and Hero just grows to fill it, pushing the
 * measured height up again next time — there's no fixed point, it diverges
 * ("hero animation grid spans out of control"). A fixed, externally-chosen
 * height (mimicking a normal browser window) sidesteps this entirely, the
 * same way a real visitor's own fixed browser window height does. The
 * iframe scrolls natively inside this fixed box; reportFrameScroll's live
 * scroll-position messages are what let the dots overlay track that scroll.
 */
const IFRAME_HEIGHT = 1080;

interface FrameDimensionsMessage {
  source: "lantern-tracker";
  type: "dimensions";
  width: number;
  height: number;
}

interface FrameScrollMessage {
  source: "lantern-tracker";
  type: "scroll";
  scrollY: number;
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

function isFrameScrollMessage(data: unknown): data is FrameScrollMessage {
  const record = data as Record<string, unknown> | null;
  if (typeof record !== "object" || record === null || record.source !== "lantern-tracker" || record.type !== "scroll") return false;
  return typeof record.scrollY === "number" && Number.isFinite(record.scrollY);
}

/**
 * Live iframe of the tracked page (fixed viewport height, scrolls natively)
 * with a click-density overlay on top. Placing each dot correctly requires
 * two things cross-origin JS can't read from the iframe directly — the
 * embedded page's real total height, and its current scroll position — so
 * the tracker's frame-report.ts posts both via postMessage (opt-in via
 * data-heatmap).
 *
 * The iframe itself must mount unconditionally, before any dimensions
 * message exists — otherwise the embedded page never gets a chance to load
 * and report back, so no message could ever arrive (an earlier version of
 * this component gated the iframe's very existence on `dimensions` already
 * being set, which meant it could never receive the message that sets it).
 * Only the overlay dots wait on `dimensions`; the iframe itself doesn't
 * depend on it at all (see IFRAME_HEIGHT above).
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
  const [scrollY, setScrollY] = useState(0);
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
    setScrollY(0);
    setBlocked(false);

    function onMessage(e: MessageEvent) {
      if (isFrameDimensionsMessage(e.data)) {
        setDimensions({ width: e.data.width, height: e.data.height });
      } else if (isFrameScrollMessage(e.data)) {
        setScrollY(e.data.scrollY);
      }
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
  // Never render the iframe narrower than MIN_DESKTOP_WIDTH (avoids the
  // squeeze bug), but never scale it up past 1:1 either (avoids the zoom
  // bug) — effectiveWidth just grows to match a wider container instead.
  const effectiveWidth = Math.max(containerWidth, MIN_DESKTOP_WIDTH);
  const scale = containerWidth / effectiveWidth;
  const scaledHeight = IFRAME_HEIGHT * scale;

  return (
    <div style={card}>
      <div ref={containerRef} style={{ borderRadius: theme.radius.control, border: `1px solid ${theme.color.cardBorder}`, overflow: "hidden" }}>
        <div style={{ position: "relative", width: "100%", height: scaledHeight }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: effectiveWidth,
              height: IFRAME_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              overflow: "hidden",
            }}
          >
            <iframe
              src={`${siteUrl}${path}`}
              title={`Live preview of ${path}`}
              style={{ width: effectiveWidth, height: IFRAME_HEIGHT, border: "none" }}
            />
            {dimensions && (
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {shownPoints.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: (p.xPct / 100) * effectiveWidth,
                      top: (p.yPct / 100) * dimensions.height - scrollY,
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
      </div>
      <p style={{ fontSize: "0.72rem", color: theme.color.textMuted, marginTop: "0.6rem", marginBottom: 0 }}>
        {points.length} click{points.length === 1 ? "" : "s"} recorded for {path} in the last ~30 days · scroll the preview to see clicks further down the page
      </p>
    </div>
  );
}
