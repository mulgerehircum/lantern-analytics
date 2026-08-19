import Link from "next/link";
import { theme, card } from "@/lib/theme";
import { LocalDateTime } from "./LocalDateTime";
import { formatCustomEventLabel } from "@/lib/interaction-timeline";

export interface EventOccurrenceRow {
  timestampIso: string;
  name: string;
  metadata?: Record<string, string | number | boolean>;
  country?: string;
  device?: string;
  /** undefined = no matching session recorded — never captured, or already expired past its own retention. */
  sessionHref?: string;
}

/**
 * Individual custom-event firings (not the aggregate counts shown in the
 * tables above) — the reverse-lookup direction of lib/session-correlation.ts:
 * from one occurrence, straight to which session it happened in and when.
 */
export function EventOccurrenceList({ rows, totalCount }: { rows: EventOccurrenceRow[]; totalCount: number }) {
  return (
    <div style={card}>
      <div style={{ fontWeight: theme.font.weight.semibold, fontSize: "0.85rem", marginBottom: "0.3rem" }}>Recent occurrences</div>
      <div style={{ fontSize: "0.72rem", color: theme.color.textMuted, marginBottom: "0.7rem" }}>
        Showing {rows.length} of {totalCount} most recent occurrences · trailing ~30 days
      </div>
      {rows.length === 0 ? (
        <p style={{ color: theme.color.textFaint, fontSize: "0.82rem", margin: 0 }}>No custom events in the last ~30 days.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ textAlign: "left", color: theme.color.textMuted }}>
              <th style={{ padding: "0.4rem 0.6rem 0.4rem 0", fontWeight: theme.font.weight.medium }}>When</th>
              <th style={{ padding: "0.4rem 0.6rem", fontWeight: theme.font.weight.medium }}>Event</th>
              <th style={{ padding: "0.4rem 0.6rem", fontWeight: theme.font.weight.medium }}>Country</th>
              <th style={{ padding: "0.4rem 0.6rem", fontWeight: theme.font.weight.medium }}>Device</th>
              <th style={{ padding: "0.4rem 0 0.4rem 0.6rem", fontWeight: theme.font.weight.medium }}>Session</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${theme.color.cardBorder}` }}>
                <td style={{ padding: "0.5rem 0.6rem 0.5rem 0" }}>
                  <LocalDateTime iso={row.timestampIso} />
                </td>
                <td style={{ padding: "0.5rem 0.6rem" }}>{formatCustomEventLabel(row.name, row.metadata)}</td>
                <td style={{ padding: "0.5rem 0.6rem" }}>{row.country ?? "—"}</td>
                <td style={{ padding: "0.5rem 0.6rem" }}>{row.device ?? "—"}</td>
                <td style={{ padding: "0.5rem 0 0.5rem 0.6rem" }}>
                  {row.sessionHref ? (
                    <Link href={row.sessionHref} style={{ color: theme.color.brand, textDecoration: "none", fontWeight: theme.font.weight.semibold }}>
                      View in session ↗
                    </Link>
                  ) : (
                    <span style={{ color: theme.color.textFaint }}>No recording</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
