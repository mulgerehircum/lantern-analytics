import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { EnrichedPageviewEvent } from "@lantern/shared";
import { parsePageviewEvent } from "./validate";
import { computeVisitorHash } from "./visitor-hash";
import { classifyDevice } from "./device";
import { resolveCountry } from "./geo";
import { putRawEvent } from "./dynamodb";
import { corsHeaders } from "./cors";

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

  const pageview = parsePageviewEvent(event.body);
  if (!pageview) {
    return { statusCode: 400, headers, body: "Invalid payload" };
  }

  // Source IP: read once, used only as hashing input below, never persisted.
  const sourceIp = event.requestContext.http.sourceIp;
  const userAgent = event.headers["user-agent"] ?? "";

  const enriched: EnrichedPageviewEvent = {
    siteId: pageview.siteId,
    path: pageview.path,
    referrer: pageview.referrer,
    timestamp: pageview.timestamp,
    visitorHash: computeVisitorHash(sourceIp, userAgent),
    country: resolveCountry(event.headers["cloudfront-viewer-country"]),
    device: classifyDevice(userAgent),
  };

  await putRawEvent(enriched);

  return { statusCode: 204, headers };
}
