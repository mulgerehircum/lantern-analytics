"use client";

import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";
import { theme } from "@/lib/theme";

export interface TrendPoint {
  key: string;
  /** Full label for tooltips, e.g. "September 15, 2026". */
  label: string;
  /** Short axis label, e.g. "Sep 15". */
  tick: string;
  /** When set, the tick/label swap to the viewer's local rendering of this ISO timestamp after mount. */
  tickIso?: string;
  pageviews: number;
  uniques: number;
  /** Drill-down destination for this point (one level deeper). */
  href?: string;
}

/** Catmull-Rom smoothing - straight segments make sparsejagged polylines out of few points. */
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return "";
  if (pts.length < 3) return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

/**
 * Single area chart for the overview card, all drill depths. Dependency-free
 * SVG with a 0-100 viewBox (non-uniform scale, non-scaling strokes), so it
 * fills any width without measuring it - text, dots, and tooltips are HTML
 * overlays positioned by the same percentage math, never SVG text (which
 * would distort under the non-uniform scale).
 *
 * Series toggles, hover tooltips, and the peak marker are the only client
 * state here; labels/ticks arrive as plain SSR-safe strings (hour ticks
 * re-localize after mount from tickIso, the old HourBar pattern).
 */
export function TrendAreaChart({
  points,
  pageviewTotal,
  uniquesTotal,
  metaRight,
}: {
  points: TrendPoint[];
  pageviewTotal: number;
  uniquesTotal: number;
  /** Granularity indicator, rendered right of the legend. */
  metaRight?: ReactNode;
}) {
  const [showPageviews, setShowPageviews] = useState(true);
  const [showUniques, setShowUniques] = useState(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [localLabels, setLocalLabels] = useState<Record<string, { tick: string; label: string }> | null>(null);
  const gradientId = useId();

  useEffect(() => {
    const isoPoints = points.filter((p) => p.tickIso);
    if (isoPoints.length === 0) return;
    const map: Record<string, { tick: string; label: string }> = {};
    for (const p of isoPoints) {
      const d = new Date(p.tickIso!);
      map[p.key] = {
        tick: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
        label: d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }),
      };
    }
    setLocalLabels(map);
  }, [points]);

  if (points.length === 0) {
    return <p style={{ color: theme.color.textFaint, fontSize: "0.82rem", margin: 0 }}>No data yet</p>;
  }

  const n = points.length;
  const x = (i: number) => (n === 1 ? 50 : 1 + (i / (n - 1)) * 98);
  const visibleMax = Math.max(
    1,
    ...points.map((p) => Math.max(showPageviews ? p.pageviews : 0, showUniques ? p.uniques : 0)),
  );
  const y = (v: number) => 6 + (1 - v / visibleMax) * 88;

  const pvPts = points.map((p, i) => ({ x: x(i), y: y(p.pageviews) }));
  const uqPts = points.map((p, i) => ({ x: x(i), y: y(p.uniques) }));
  const pvLine = smoothPath(pvPts);
  const uqLine = smoothPath(uqPts);
  const areaPath = `${pvLine} L${x(n - 1).toFixed(2)},100 L${x(0).toFixed(2)},100 Z`;

  const primaryOf = (p: TrendPoint) => (showPageviews ? p.pageviews : p.uniques);
  const peakIndex = points.reduce((best, p, i) => (primaryOf(p) > primaryOf(points[best]) ? i : best), 0);
  // Markers stay pinned at the peak; the tooltip itself only appears on hover.
  const focusIndex = hoverIndex ?? peakIndex;
  const focus = points[focusIndex];

  const tickIndexes = n <= 7 ? points.map((_, i) => i) : Array.from({ length: 7 }, (_, k) => Math.round((k * (n - 1)) / 6));
  const tickFor = (p: TrendPoint) => (localLabels && p.key in localLabels ? localLabels[p.key].tick : p.tick);
  const labelFor = (p: TrendPoint) => (localLabels && p.key in localLabels ? localLabels[p.key].label : p.label);
  const gridFractions = [1, 0.75, 0.5, 0.25];

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverIndex(Math.round(ratio * (n - 1)));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", fontSize: "0.75rem" }}>
          <LegendToggle
            label={`Pageviews (${pageviewTotal})`}
            swatch={{ background: theme.color.brand }}
            textColor={theme.color.text}
            active={showPageviews}
            onToggle={() => setShowPageviews((v) => !v)}
          />
          <LegendToggle
            label={`Uniques (${uniquesTotal})`}
            swatch={{ background: theme.color.brandTintBg, border: `1px solid ${theme.color.brand}` }}
            textColor={theme.color.textMuted}
            active={showUniques}
            onToggle={() => setShowUniques((v) => !v)}
          />
        </div>
        {metaRight}
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          height: 192,
          background: theme.color.bg,
          borderRadius: theme.radius.control,
          padding: 8,
          border: `1px solid ${theme.color.border}`,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "relative", width: "100%", height: "100%" }} onMouseMove={onMouseMove} onMouseLeave={() => setHoverIndex(null)}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#558a30" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#558a30" stopOpacity="0" />
              </linearGradient>
            </defs>
            {gridFractions.map((f) => (
              <line
                key={f}
                x1={1}
                x2={99}
                y1={6 + (1 - f) * 88}
                y2={6 + (1 - f) * 88}
                stroke="var(--color-underline)"
                strokeOpacity={f === 1 ? 0.6 : 0.4}
                strokeWidth={1}
                strokeDasharray={f === 1 ? undefined : "3 2"}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {showPageviews && (
              <>
                <path d={areaPath} fill={`url(#${gradientId})`} />
                <path
                  d={pvLine}
                  fill="none"
                  stroke="var(--color-brand)"
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}
            {showUniques && (
              <path
                d={uqLine}
                fill="none"
                stroke="var(--color-brand-tint-text-strong)"
                strokeWidth={2}
                strokeDasharray="4 3"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
            <line
              x1={x(focusIndex)}
              x2={x(focusIndex)}
              y1={0}
              y2={100}
              stroke="var(--color-brand)"
              strokeWidth={1}
              strokeDasharray="2 2"
              opacity={0.6}
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {gridFractions.map((f) => (
            <span
              key={f}
              aria-hidden
              style={{
                position: "absolute",
                left: 2,
                top: `${6 + (1 - f) * 88}%`,
                transform: "translateY(-100%)",
                fontSize: "0.625rem",
                fontFamily: theme.font.mono,
                color: theme.color.textFaint,
                pointerEvents: "none",
              }}
            >
              {Math.round(visibleMax * f)}
            </span>
          ))}

          {showPageviews && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: `${x(focusIndex)}%`,
                top: `${y(focus.pageviews)}%`,
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: theme.color.brand,
                border: `2px solid ${theme.color.cardBg}`,
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
              }}
            />
          )}
          {showUniques && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: `${x(focusIndex)}%`,
                top: `${y(focus.uniques)}%`,
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: theme.color.brandTintTextStrong,
                border: `2px solid ${theme.color.cardBg}`,
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
              }}
            />
          )}

          {points.map((p, i) =>
            p.href ? (
              <a
                key={p.key}
                href={p.href}
                aria-label={`${labelFor(p)}: ${p.pageviews} pageviews, ${p.uniques} uniques`}
                title={`${labelFor(p)}: ${p.pageviews} pageviews`}
                style={{
                  position: "absolute",
                  left: `${x(i)}%`,
                  top: `${y(primaryOf(p))}%`,
                  width: 20,
                  height: 20,
                  transform: "translate(-50%, -50%)",
                }}
              />
            ) : null,
          )}

          {hoverIndex !== null && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: `${x(focusIndex)}%`,
                top: 8,
                transform: `translate(${x(focusIndex) > 65 ? "-100%" : x(focusIndex) < 35 ? "0" : "-50%"}, 0)`,
                background: theme.color.text,
                color: theme.color.bg,
                fontSize: "0.6875rem",
                borderRadius: theme.radius.small,
                padding: "6px 10px",
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              <div style={{ fontFamily: theme.font.mono, fontSize: "0.5625rem", color: theme.color.textFaint, marginBottom: "0.125rem" }}>
                {labelFor(focus)}
              </div>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", fontWeight: theme.font.weight.medium }}>
                <span>
                  <span style={{ color: theme.color.brand }}>●</span> {focus.pageviews} view{focus.pageviews === 1 ? "" : "s"}
                </span>
                <span>
                  <span style={{ opacity: 0.6 }}>●</span> {focus.uniques} unique{focus.uniques === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ position: "relative", height: "1.4rem", marginTop: "0.5rem", padding: "0 0.5rem" }}>
        {tickIndexes.map((i) => (
          <span
            key={points[i].key}
            style={{
              position: "absolute",
              left: `${x(i)}%`,
              transform: i === 0 ? "translateX(0)" : i === n - 1 ? "translateX(-100%)" : "translateX(-50%)",
              fontSize: "0.6875rem",
              fontFamily: theme.font.mono,
              color: theme.color.textFaint,
              whiteSpace: "nowrap",
            }}
          >
            {tickFor(points[i])}
          </span>
        ))}
      </div>
    </div>
  );
}

function LegendToggle({
  label,
  swatch,
  textColor,
  active,
  onToggle,
}: {
  label: string;
  swatch: React.CSSProperties;
  textColor: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title={active ? `Hide ${label}` : `Show ${label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        background: "none",
        border: "none",
        padding: 0,
        fontSize: "inherit",
        fontFamily: "inherit",
        fontWeight: theme.font.weight.medium,
        color: active ? textColor : theme.color.textFaint,
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 12,
          height: 12,
          borderRadius: 2,
          display: "inline-block",
          ...(active ? swatch : { background: "transparent", border: `1px solid ${theme.color.textFaint}` }),
        }}
      />
      {label}
    </button>
  );
}
