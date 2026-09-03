import { notFound } from "next/navigation";
import { getAllRawEvents, getHourlyRollups, getLiveRawEvents, currentHourSK } from "@/lib/dynamodb";
import { aggregateEvents } from "@/lib/aggregate";
import { summarizeRollups } from "@/lib/summarize";
import { computeFunnel } from "@/lib/funnel";
import type { FunnelStep } from "@/lib/funnel";
import { DEFAULT_SITE_ID, getSite } from "@/lib/sites";
import { FUNNELS_ENABLED } from "@/lib/flags";
import { theme, card } from "@/lib/theme";
import { fieldStyle } from "@/components/ProjectSelector";
import { AppShell } from "@/components/AppShell";
import { FunnelChart } from "@/components/FunnelChart";

const MAX_STEPS = 5;

const PRESETS: Array<{ label: string; steps: FunnelStep[] }> = [
  {
    label: "Card view → project link click",
    steps: [
      { type: "event", value: "card_variant_view" },
      { type: "event", value: "project_link_click" },
    ],
  },
  {
    label: "Landing → contact click",
    steps: [
      { type: "path", value: "/" },
      { type: "event", value: "contact_click" },
    ],
  },
];

function presetHref(siteId: string, steps: FunnelStep[]): string {
  const params = new URLSearchParams({ siteId });
  steps.forEach((step, i) => {
    params.set(`step${i + 1}Type`, step.type);
    params.set(`step${i + 1}Value`, step.value);
  });
  return `/funnels?${params.toString()}`;
}

function parseSteps(params: Record<string, string | undefined>): FunnelStep[] {
  const steps: FunnelStep[] = [];
  for (let i = 1; i <= MAX_STEPS; i++) {
    const type = params[`step${i}Type`];
    const value = params[`step${i}Value`]?.trim();
    if ((type === "path" || type === "event") && value) {
      steps.push({ type, value });
    }
  }
  return steps;
}

export default async function FunnelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!FUNNELS_ENABLED) notFound();

  const params = await searchParams;
  const requestedSiteId = params.siteId?.trim() || DEFAULT_SITE_ID;
  const site = getSite(requestedSiteId);
  const siteId = site ? site.siteId : requestedSiteId;

  const [rawEvents, rollups, liveEvents] = await Promise.all([
    getAllRawEvents(siteId),
    getHourlyRollups(siteId),
    getLiveRawEvents(siteId),
  ]);
  const liveRollup = { SK: currentHourSK(), ...aggregateEvents(liveEvents) };
  const summary = summarizeRollups([...rollups, liveRollup]);

  const steps = parseSteps(params);
  const results = computeFunnel(rawEvents, steps);

  const stepSlots = Array.from({ length: MAX_STEPS }, (_, i) => i + 1);
  const currentStep = (i: number) => ({
    type: params[`step${i}Type`] ?? "",
    value: params[`step${i}Value`] ?? "",
  });

  return (
    <AppShell
      siteId={siteId}
      siteUrl={site?.url}
      activeView="funnels"
      basePath="/funnels"
      title={
        <>
          {site ? site.name : siteId}
          {!site && <span style={{ fontSize: "0.85rem", fontWeight: 400, color: theme.color.amber }}> - not in site registry</span>}
        </>
      }
    >
      <p style={{ color: theme.color.textMuted, fontSize: "0.82rem", margin: "0 0 1.2rem" }}>
        Define an ordered sequence of pages/events and see how many visitors reached each step, in order. Bounded to the
        trailing ~30-day raw-event window (same as the Events page's reverse lookup).
      </p>

      <datalist id="funnel-values">
        {summary.topPages.map((p) => (
          <option key={`path-${p.path}`} value={p.path} />
        ))}
        {summary.customEvents.map((e) => (
          <option key={`event-${e.name}`} value={e.name} />
        ))}
      </datalist>

      <form method="GET" style={{ ...card, marginBottom: "1.25rem" }}>
        <input type="hidden" name="siteId" value={siteId} />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {stepSlots.map((i) => {
            const step = currentStep(i);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.78rem", color: theme.color.textMuted, width: 48, flexShrink: 0 }}>Step {i}</span>
                <select name={`step${i}Type`} defaultValue={step.type} style={{ ...fieldStyle, width: 90 }}>
                  <option value="">- none -</option>
                  <option value="path">Path</option>
                  <option value="event">Event</option>
                </select>
                <input
                  type="text"
                  name={`step${i}Value`}
                  defaultValue={step.value}
                  list="funnel-values"
                  placeholder="/path or event_name"
                  style={{ ...fieldStyle, flex: 1 }}
                />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.9rem" }}>
          <button type="submit" style={{ ...fieldStyle, cursor: "pointer", background: theme.color.brand, color: theme.color.onBrand, border: "none" }}>
            Apply
          </button>
          <a
            href={`/funnels?siteId=${encodeURIComponent(siteId)}`}
            style={{ ...fieldStyle, textDecoration: "none", color: theme.color.textMuted, display: "inline-flex", alignItems: "center" }}
          >
            Clear
          </a>
        </div>
      </form>

      {steps.length === 0 && (
        <div style={{ ...card, marginBottom: "1.25rem" }}>
          <div style={{ fontWeight: theme.font.weight.semibold, fontSize: "0.85rem", marginBottom: "0.6rem" }}>Quick start</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {PRESETS.map((preset) => (
              <a key={preset.label} href={presetHref(siteId, preset.steps)} style={{ color: theme.color.brand, fontSize: "0.82rem", textDecoration: "none", fontWeight: theme.font.weight.semibold }}>
                {preset.label} →
              </a>
            ))}
          </div>
        </div>
      )}

      <FunnelChart results={results} />
    </AppShell>
  );
}
