import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { EnrichedCustomEvent, EnrichedPageviewEvent } from "@lantern/shared";
import { parseTrackedEvent } from "./validate";
import { computeVisitorHash } from "./visitor-hash";
import { classifyDevice } from "./device";
import { resolveCountry } from "./geo";
import { putRawEvent } from "./dynamodb";
import { corsHeaders } from "./cors";
import { isIpExcluded, parseExcludedIps } from "./ip-exclude";

// Parsed once per Lambda container (the env var is set at deploy time).
const EXCLUDED_IPS = parseExcludedIps(process.env.EXCLUDED_IPS);

/**
 * API Gateway (HTTP API) entry point. Both OPTIONS and POST are routed here
 * (see infra/lib/lantern-stack.ts) — CORS is handled entirely in this
 * Lambda, not via API Gateway's declarative CORS feature (see cors.ts for
 * why: sendBeacon's forced credentials mode needs a dynamically reflected
 * Origin, which that feature can't do once credentials are involved).
 */
export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method;
  const headers = corsHeaders(event.headers["origin"]);

  if (method === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (method !== "POST") {
    return { statusCode: 405, headers, body: "Method Not Allowed" };
  }

  const tracked = parseTrackedEvent(event.body);
  if (!tracked) {
    return { statusCode: 400, headers, body: "Invalid payload" };
  }

  // Source IP: read once, used only as hashing input below, never persisted.
  const sourceIp = event.requestContext.http.sourceIp;

  // Self-exclusion: drop events from excluded IPs/CIDRs before any hashing or
  // persistence. 204 is indistinguishable from a normal success on purpose —
  // analytics must never surface an error to the caller.
  if (isIpExcluded(sourceIp, EXCLUDED_IPS)) {
    return { statusCode: 204, headers };
  }

  const userAgent = event.headers["user-agent"] ?? "";
  const visitorHash = computeVisitorHash(sourceIp, userAgent);
  const country = resolveCountry(event.headers["cloudfront-viewer-country"]);
  const device = classifyDevice(userAgent);

  if ("name" in tracked) {
    const enriched: EnrichedCustomEvent = {
      siteId: tracked.siteId,
      name: tracked.name,
      path: tracked.path,
      metadata: tracked.metadata,
      timestamp: tracked.timestamp,
      visitorHash,
      country,
      device,
    };
    await putRawEvent(enriched);
  } else {
    const enriched: EnrichedPageviewEvent = {
      siteId: tracked.siteId,
      path: tracked.path,
      referrer: tracked.referrer,
      timestamp: tracked.timestamp,
      visitorHash,
      country,
      device,
    };
    await putRawEvent(enriched);
  }

  return { statusCode: 204, headers };
}
