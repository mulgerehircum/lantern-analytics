import { theme, card } from "@/lib/theme";
import type { FunnelStepResult } from "@/lib/funnel";

function stepLabel(step: FunnelStepResult["step"]): string {
  return step.type === "path" ? `Path: ${step.value}` : `Event: ${step.value}`;
}

/**
 * Horizontal bar per step — percentage widths are safe here since each row
 * is a normal block-level div with a real width to resolve against.
 */
export function FunnelChart({ results }: { results: FunnelStepResult[] }) {
  if (results.length === 0) {
    return <p style={{ color: theme.color.textFaint, fontSize: "0.82rem", margin: 0 }}>Add at least one step below to see a funnel.</p>;
  }

  const startCount = results[0].visitorCount;

  return (
    <div style={card}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        {results.map((result, i) => (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "0.3rem" }}>
              <span style={{ fontWeight: theme.font.weight.semibold }}>{stepLabel(result.step)}</span>
              <span style={{ color: theme.color.textMuted }}>
                {result.visitorCount} visitor{result.visitorCount === 1 ? "" : "s"}
                {i > 0 && ` · ${result.conversionFromPreviousPercent}% of previous step`}
              </span>
            </div>
            <div style={{ background: theme.color.brandTintBg, borderRadius: theme.radius.small, height: 22, position: "relative", overflow: "hidden" }}>
              <div
                style={{
                  width: `${startCount > 0 ? Math.max((result.visitorCount / startCount) * 100, result.visitorCount > 0 ? 2 : 0) : 0}%`,
                  height: "100%",
                  background: theme.color.brand,
                  borderRadius: theme.radius.small,
                }}
              />
            </div>
            <div style={{ fontSize: "0.72rem", color: theme.color.textMutedLight, marginTop: "0.2rem" }}>
              {result.conversionFromStartPercent}% of step 1
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
