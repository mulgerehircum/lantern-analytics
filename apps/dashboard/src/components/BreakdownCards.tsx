import Link from "next/link";
import { card, theme } from "@/lib/theme";
import { ExportCsvButton } from "./ExportCsvButton";
import { buildRowsCsv } from "@/lib/csv";
import { buildRowFilterHref } from "@/lib/filter-ui";

/**
 * Devices breakdown with a fixed desktop/mobile/tablet row set - zero rows
 * render dimmed rather than vanishing, so "no mobile traffic" reads as an
 * explicit fact instead of missing data. Each row links into Overview's
 * device dimension filter (same click-to-filter contract as DataTableCard
 * rows); zero-count rows stay non-interactive - filtering to an empty
 * slice is a dead end, and dimmed-but-clickable would mislead.
 */
export function DevicesCard({
  devices,
  periodLabel,
  siteId,
  activeDevice,
}: {
  devices: Array<{ device: string; count: number }>;
  periodLabel?: string;
  /** Builds each row's filter href; omitted renders plain rows (no filter target). */
  siteId?: string;
  activeDevice?: string;
}) {
  const byName = new Map(devices.map((d) => [d.device.toLowerCase(), d.count]));
  const rows = [
    { key: "desktop", label: "Desktop", icon: "fa-desktop", count: byName.get("desktop") ?? 0 },
    { key: "mobile", label: "Mobile", icon: "fa-mobile-screen", count: byName.get("mobile") ?? 0 },
    { key: "tablet", label: "Tablet", icon: "fa-tablet-screen-button", count: byName.get("tablet") ?? 0 },
  ];
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const top = rows.reduce((a, b) => (b.count > a.count ? b : a), rows[0]);
  const topShare = total > 0 ? ((top.count / total) * 100).toFixed(0) : "0";
  const rowHref = (key: string) => (siteId ? buildRowFilterHref(siteId, "device", key) : undefined);

  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: "0.75rem",
          borderBottom: `1px solid ${theme.color.border}`,
          marginBottom: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <i className="fa-solid fa-laptop" style={{ color: theme.color.textMuted, fontSize: "0.75rem" }} />
          <div style={{ fontWeight: theme.font.weight.bold, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Devices & OS
          </div>
        </div>
        <span style={{ fontSize: "0.6875rem", fontFamily: theme.font.mono, color: theme.color.textFaint }}>
          {topShare}% {top.label}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {rows.map((row) => {
          const pct = total > 0 ? (row.count / total) * 100 : 0;
          const zero = row.count === 0;
          const active = activeDevice === row.key;
          const href = zero ? undefined : rowHref(row.key);
          const rowStyle: React.CSSProperties = {
            display: "block",
            padding: "0.4rem 0.4rem",
            margin: "0 -0.4rem",
            borderRadius: theme.radius.small,
            background: active ? theme.color.brandTintBg : undefined,
            opacity: zero ? 0.5 : undefined,
            textDecoration: "none",
            color: "inherit",
          };
          const content = (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", marginBottom: "0.375rem" }}>
                <span style={{ fontWeight: theme.font.weight.semibold, display: "flex", alignItems: "center", gap: "0.5rem", color: zero ? theme.color.textMuted : theme.color.text }}>
                  <i className={`fa-solid ${row.icon}`} style={{ color: zero ? theme.color.textFaint : theme.color.textMuted }} />
                  {row.label}
                </span>
                <span style={{ fontFamily: theme.font.mono, color: zero ? theme.color.textMuted : theme.color.text }}>
                  <span style={{ fontWeight: theme.font.weight.bold }}>{row.count}</span>{" "}
                  <span style={{ color: theme.color.textFaint, fontSize: "0.625rem" }}>({pct.toFixed(0)}%)</span>
                </span>
              </div>
              <span
                aria-hidden
                style={{ display: "block", height: 8, borderRadius: 999, background: theme.color.bg, border: `1px solid ${theme.color.border}`, overflow: "hidden" }}
              >
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: `${pct}%`,
                    borderRadius: 999,
                    background: pct < 100 / 3 ? theme.color.thresholdLow : pct < 200 / 3 ? theme.color.thresholdMid : theme.color.thresholdHigh,
                  }}
                />
              </span>
            </>
          );
          return href ? (
            <Link key={row.key} href={href} className="lantern-row-link" style={rowStyle} title={`Filter dashboard to ${row.label.toLowerCase()} sessions`}>
              {content}
            </Link>
          ) : (
            <div key={row.key} style={rowStyle}>
              {content}
            </div>
          );
        })}
      </div>
      {byName.get("mobile") === 0 && (byName.get("tablet") ?? 0) === 0 && total > 0 && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.625rem",
            borderRadius: theme.radius.control,
            background: theme.color.brandTintBg,
            border: `1px solid ${theme.color.border}`,
            fontSize: "0.6875rem",
            color: theme.color.brandTintText,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ fontWeight: theme.font.weight.semibold, color: theme.color.brandTintTextStrong }}>Insight:</strong> Zero mobile
          traffic{periodLabel ? ` in ${periodLabel}` : ""}. This site is consumed via desktop workstations.
        </div>
      )}
    </div>
  );
}

/**
 * Custom events as share tiles - name, count, and share of all custom
 * events. Each tile links into Overview's eventName filter (same
 * click-to-filter contract as DataTableCard rows; an event-name filter is
 * a custom-events view by construction - pageviews carry no `name`).
 */
export function CustomEventTiles({
  events,
  exportFilename,
  siteId,
  activeEventName,
}: {
  events: Array<{ name: string; count: number }>;
  exportFilename?: string;
  /** Builds each tile's filter href; omitted renders plain tiles (no filter target). */
  siteId?: string;
  activeEventName?: string;
}) {
  const total = events.reduce((sum, e) => sum + e.count, 0);
  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: "0.75rem",
          borderBottom: `1px solid ${theme.color.border}`,
          marginBottom: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <i className="fa-solid fa-bolt" style={{ color: theme.color.textMuted, fontSize: "0.75rem" }} />
          <div style={{ fontWeight: theme.font.weight.bold, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Custom Events
          </div>
        </div>
        {exportFilename && events.length > 0 && (
          <ExportCsvButton csv={buildRowsCsv(events.map((e) => ({ key: e.name, count: e.count })))} filename={exportFilename} />
        )}
      </div>
      {events.length === 0 ? (
        <p style={{ color: theme.color.textFaint, fontSize: "0.82rem", margin: 0 }}>No data yet</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
          {events.map((event) => {
            const share = total > 0 ? (event.count / total) * 100 : 0;
            const active = activeEventName === event.name;
            const tileStyle: React.CSSProperties = {
              padding: "0.75rem",
              background: active ? theme.color.brandTintBg : theme.color.bg,
              border: `1px solid ${active ? theme.color.brand : theme.color.border}`,
              borderRadius: theme.radius.control,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.5rem",
              textDecoration: "none",
              color: "inherit",
            };
            const tileHref = siteId ? buildRowFilterHref(siteId, "eventName", event.name) : undefined;
            const tile = (
              <>
                <div style={{ fontFamily: theme.font.mono, fontSize: "0.75rem", fontWeight: theme.font.weight.semibold, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {event.name}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: theme.font.mono, fontSize: "1rem", fontWeight: theme.font.weight.bold }}>{event.count}</div>
                  <div
                    style={{
                      fontSize: "0.625rem",
                      color: share < 100 / 3 ? theme.color.thresholdLow : share < 200 / 3 ? theme.color.thresholdMid : theme.color.thresholdHigh,
                      fontWeight: theme.font.weight.semibold,
                    }}
                  >
                    {share.toFixed(1)}% share
                  </div>
                </div>
              </>
            );
            return tileHref ? (
              <Link key={event.name} href={tileHref} className="lantern-row-link" style={tileStyle} title={`Filter dashboard to ${event.name} events`}>
                {tile}
              </Link>
            ) : (
              <div key={event.name} style={tileStyle}>
                {tile}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
