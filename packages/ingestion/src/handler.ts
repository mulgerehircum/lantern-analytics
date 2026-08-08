import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { EnrichedPageviewEvent } from "@lantern/shared";
import { parsePageviewEvent } from "./validate";
import { computeVisitorHash } from "./visitor-hash";
import { classifyDevice } from "./device";
import { resolveCountry } from "./geo";
import { putRawEvent } from "./dynamodb";
import { CORS_HEADERS } from "./cors";

/**
 * API Gateway (HTTP API) entry point. `sendBeacon` with a JSON Blob triggers
 * a CORS preflight, so OPTIONS has to be handled explicitly here, not just
 * the POST path.
 */
export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method;

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS };
  }

  if (method !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: "Method Not Allowed" };
  }

  const pageview = parsePageviewEvent(event.body);
  if (!pageview) {
    return { statusCode: 400, headers: CORS_HEADERS, body: "Invalid payload" };
  }

  // Source IP: read once, used only as hashing/geo input below, never persisted.
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

  return { statusCode: 204, headers: CORS_HEADERS };
}
