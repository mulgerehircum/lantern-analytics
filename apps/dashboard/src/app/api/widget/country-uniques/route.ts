import { NextRequest, NextResponse } from "next/server";
import { getHourlyRollups, getAllRawEvents } from "@/lib/dynamodb";
import { DEFAULT_SITE_ID, getSite } from "@/lib/sites";

/**
 * Public widget endpoint: all-time per-country uniques for one country,
 * served as `{ siteId, country, uniques }` for the portfolio's
 * "visitors from Ukraine" widget.
 *
 * Read model, self-healing across the rollup-field rollout:
 * - Rollups written after this field shipped carry `countryUniques`; sum them.
 * - Hours whose rollup lacks the field (pre-rollout hours, still within the
 *   30-day raw-event TTL) are recomputed from raw events instead. The
 *   covered-hour set prevents double counting: a raw event is counted only
 *   when its hour has no countryUniques-bearing rollup.
 * - Raw events TTL out after 30 days, so pre-rollout hours older than that
 *   are permanently unknowable - the number is honest about that ceiling:
 *   it's "since the field shipped" (plus whatever raw window remains), not
 *   since the site launched. The count only grows going forward.
 *
 * getAllRawEvents (60s-cached) rather than getLiveRawEvents: it returns the
 * SK-annotated records this route needs to bucket events by hour, and a
 * minute of staleness is fine for a widget (the response is cached 60s
 * anyway).
 *
 * CORS is deliberately restricted to the registered site's production origin
 * (from the site registry's `url`): this is a public unauthenticated endpoint
 * otherwise, and the dashboard has no auth of its own. Requests with an Origin
 * header not matching that URL get no CORS headers, which makes the response
 * unreadable cross-origin from browsers while leaving same-origin dashboard
 * use and curl debugging unaffected.
 */

interface WidgetResponse {
  siteId: string;
  country: string;
  uniques: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const siteId = request.nextUrl.searchParams.get("siteId")?.trim() || DEFAULT_SITE_ID;
  const rawCountry = request.nextUrl.searchParams.get("country")?.trim().toUpperCase();

  if (!rawCountry || !/^[A-Z]{2}$/.test(rawCountry)) {
    return NextResponse.json({ error: "country must be a 2-letter ISO code" }, { status: 400 });
  }
  const country: string = rawCountry;

  // Only sites in the registry with a production URL are widget-eligible -
  // this endpoint is public; unregistered sites get a 404, not a 0.
  const site = getSite(siteId);
  if (!site?.url) {
    return NextResponse.json({ error: "unknown site" }, { status: 404 });
  }

  const [rollups, rawEvents] = await Promise.all([
    getHourlyRollups(siteId),
    getAllRawEvents(siteId),
  ]);

  let uniques = 0;
  const coveredHours = new Set<string>();

  for (const rollup of rollups) {
    if (rollup.countryUniques) {
      uniques += rollup.countryUniques[country] ?? 0;
      // "AGG#2026-08-08#14" -> "2026-08-08T14", the raw-event hour prefix
      const hour = rollup.SK.slice(4).replace("#", "T");
      coveredHours.add(hour);
    }
  }

  // Raw events fill exactly one gap: hours whose rollup predates the field.
  // Counted only when their hour has no bearing rollup, so no hour is ever
  // double-counted. Custom events never carry isNewVisit semantics anyway
  // (they're not pageviews) and are skipped explicitly for clarity.
  for (const event of rawEvents) {
    if (event.name || !event.isNewVisit || event.country !== country) continue;
    const hour = event.SK.split("#")[1]?.slice(0, 13);
    if (!hour || coveredHours.has(hour)) continue;
    uniques += 1;
  }

  const response: WidgetResponse = { siteId, country, uniques };
  const headers = new Headers({ "Cache-Control": "public, max-age=60, s-maxage=60" });
  const origin = request.headers.get("origin");
  if (origin && origin === site.url) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return NextResponse.json(response, { headers });
}
