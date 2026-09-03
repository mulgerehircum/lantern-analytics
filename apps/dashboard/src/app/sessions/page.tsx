import Link from "next/link";
import { getAllRawEvents } from "@/lib/dynamodb";
import { getSessionRecordings } from "@/lib/sessions";
import { attachVariantToSessions } from "@/lib/experiment";
import { DEFAULT_SITE_ID, getSite } from "@/lib/sites";
import { theme, card } from "@/lib/theme";
import { fieldStyle } from "@/components/ProjectSelector";
import { AppShell } from "@/components/AppShell";
import { LocalDateTime } from "@/components/LocalDateTime";
import { formatDuration } from "@/lib/format";
import { filterSessions, hasActiveSessionFilter } from "@/lib/session-filters";
import type { SessionFilters } from "@/lib/session-filters";

/**
 * Session list (Phase 2). Same conventions as the root dashboard page:
 * Server Component fetching DynamoDB directly, `?siteId=` query-param
 * routing (not `/[siteId]/...` - see repo decisions for why). The one bit of
 * client JS is <LocalDateTime> - timestamps need the viewer's own browser
 * timezone, which only the client knows.
 *
 * `variant` is attached per session (see lib/experiment.ts) by matching raw
 * card_variant_view events, not stored on the session item itself - so it's
 * only ever available for the trailing ~30 days the raw events survive.
 */
export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string; variant?: string; device?: string; country?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const requestedSiteId = params.siteId?.trim() || DEFAULT_SITE_ID;
  const site = getSite(requestedSiteId);
  const siteId = site ? site.siteId : requestedSiteId;
  const filters: SessionFilters = {
    variant: params.variant?.trim() || undefined,
    device: params.device?.trim() || undefined,
    country: params.country?.trim() || undefined,
    from: params.from?.trim() || undefined,
    to: params.to?.trim() || undefined,
  };

  const [sessions, events] = await Promise.all([getSessionRecordings(siteId), getAllRawEvents(siteId)]);
  const sessionsWithVariant = attachVariantToSessions(sessions, events);
  const availableVariants = [...new Set(sessionsWithVariant.map((s) => s.variant).filter((v): v is string => Boolean(v)))].sort();
  const availableDevices = [
    ...new Set(sessionsWithVariant.map((s) => s.device).filter((v): v is NonNullable<typeof v> => Boolean(v))),
  ].sort();
  const availableCountries = [...new Set(sessionsWithVariant.map((s) => s.country).filter((v): v is string => Boolean(v)))].sort();
  const filteredSessions = filterSessions(sessionsWithVariant, filters);

  return (
    <AppShell
      siteId={siteId}
      siteUrl={site?.url}
      activeView="sessions"
      basePath="/sessions"
      title={
        <>
          {site ? site.name : siteId}
          {!site && <span style={{ fontSize: "0.85rem", fontWeight: 400, color: theme.color.amber }}> - not in site registry</span>}
        </>
      }
    >
      <SessionsFilterForm
        siteId={siteId}
        filters={filters}
        availableVariants={availableVariants}
        availableDevices={availableDevices}
        availableCountries={availableCountries}
      />

      <SessionsTable siteId={siteId} sessions={filteredSessions} />
    </AppShell>
  );
}

function SessionsFilterForm({
  siteId,
  filters,
  availableVariants,
  availableDevices,
  availableCountries,
}: {
  siteId: string;
  filters: SessionFilters;
  availableVariants: string[];
  availableDevices: string[];
  availableCountries: string[];
}) {
  return (
    <form
      method="GET"
      style={{
        display: "flex",
        gap: "0.5rem",
        alignItems: "flex-end",
        flexWrap: "wrap",
        margin: "0 0 1.2rem",
      }}
    >
      <input type="hidden" name="siteId" value={siteId} />
      {availableVariants.length > 0 && (
        <label style={{ fontSize: "0.75rem", color: theme.color.textMuted }}>
          Variant
          <br />
          <select name="variant" defaultValue={filters.variant ?? ""} style={fieldStyle}>
            <option value="">All</option>
            {availableVariants.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      )}
      {availableDevices.length > 0 && (
        <label style={{ fontSize: "0.75rem", color: theme.color.textMuted }}>
          Device
          <br />
          <select name="device" defaultValue={filters.device ?? ""} style={fieldStyle}>
            <option value="">All</option>
            {availableDevices.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      )}
      {availableCountries.length > 0 && (
        <label style={{ fontSize: "0.75rem", color: theme.color.textMuted }}>
          Country
          <br />
          <select name="country" defaultValue={filters.country ?? ""} style={fieldStyle}>
            <option value="">All</option>
            {availableCountries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      )}
      <label style={{ fontSize: "0.75rem", color: theme.color.textMuted }}>
        From
        <br />
        <input type="date" name="from" defaultValue={filters.from ?? ""} style={fieldStyle} />
      </label>
      <label style={{ fontSize: "0.75rem", color: theme.color.textMuted }}>
        To
        <br />
        <input type="date" name="to" defaultValue={filters.to ?? ""} style={fieldStyle} />
      </label>
      <button type="submit" style={{ ...fieldStyle, cursor: "pointer", background: theme.color.brand, color: theme.color.onBrand, border: "none" }}>
        Filter
      </button>
      {hasActiveSessionFilter(filters) && (
        <Link href={`/sessions?siteId=${encodeURIComponent(siteId)}`} style={{ fontSize: "0.85rem", color: theme.color.brand }}>
          Clear
        </Link>
      )}
    </form>
  );
}

function SessionsTable({
  siteId,
  sessions,
}: {
  siteId: string;
  sessions: Array<{
    sessionId: string;
    startedAt: string;
    durationMs: number;
    pageCount: number;
    path?: string;
    referrer?: string;
    country?: string;
    device?: string;
    variant?: string;
  }>;
}) {
  return (
    <div style={card}>
      <div style={{ fontWeight: theme.font.weight.semibold, marginBottom: "0.9rem", fontSize: "0.85rem" }}>Sessions</div>
      {sessions.length === 0 ? (
        <p style={{ color: theme.color.textFaint, fontSize: "0.82rem", margin: 0 }}>No recorded sessions yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ textAlign: "left", color: theme.color.textMuted }}>
              <th style={{ padding: "0.4rem 0.6rem 0.4rem 0", fontWeight: theme.font.weight.medium }}>Started</th>
              <th style={{ padding: "0.4rem 0.6rem", fontWeight: theme.font.weight.medium }}>Duration</th>
              <th style={{ padding: "0.4rem 0.6rem", fontWeight: theme.font.weight.medium }}>Pages</th>
              <th style={{ padding: "0.4rem 0.6rem", fontWeight: theme.font.weight.medium }}>Landing page</th>
              <th style={{ padding: "0.4rem 0.6rem", fontWeight: theme.font.weight.medium }}>Referrer</th>
              <th style={{ padding: "0.4rem 0.6rem", fontWeight: theme.font.weight.medium }}>Country</th>
              <th style={{ padding: "0.4rem 0.6rem", fontWeight: theme.font.weight.medium }}>Device</th>
              <th style={{ padding: "0.4rem 0.6rem", fontWeight: theme.font.weight.medium }}>Variant</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.sessionId} style={{ borderTop: `1px solid ${theme.color.cardBorder}` }}>
                <td style={{ padding: "0.55rem 0.6rem 0.55rem 0" }}>
                  <Link
                    href={`/sessions/${encodeURIComponent(s.sessionId)}?siteId=${encodeURIComponent(siteId)}`}
                    style={{ color: theme.color.brandTintTextStrong, fontWeight: theme.font.weight.semibold, textDecoration: "none" }}
                  >
                    <LocalDateTime iso={s.startedAt} />
                  </Link>
                </td>
                <td style={{ padding: "0.55rem 0.6rem" }}>{formatDuration(s.durationMs)}</td>
                <td style={{ padding: "0.55rem 0.6rem" }}>{s.pageCount}</td>
                <td style={{ padding: "0.55rem 0.6rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                  {s.path || "-"}
                </td>
                <td style={{ padding: "0.55rem 0.6rem" }}>{s.referrer || "direct"}</td>
                <td style={{ padding: "0.55rem 0.6rem" }}>{s.country ?? "-"}</td>
                <td style={{ padding: "0.55rem 0.6rem" }}>{s.device ?? "-"}</td>
                <td style={{ padding: "0.55rem 0.6rem", textTransform: "capitalize" }}>{s.variant ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
