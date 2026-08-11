import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { parseSessionRecordingMeta } from "./session-meta-validate";
import { putSessionRecordingMeta } from "./dynamodb";
import { corsHeaders } from "./cors";
import { isIpExcluded, parseExcludedIps } from "./ip-exclude";
import { computeVisitorHash } from "./visitor-hash";
import { classifyDevice } from "./device";
import { resolveCountry } from "./geo";

// Parsed once per Lambda container, same as handler.ts.
const EXCLUDED_IPS = parseExcludedIps(process.env.EXCLUDED_IPS);

/**
 * API Gateway (HTTP API) entry point for the session-recording metadata
 * heartbeat (see infra/lib/lantern-stack.ts's `/session-recordings/meta`
 * route). Structurally identical to handler.ts's pipeline — same CORS,
 * self-exclusion, and always-204 discipline — because this is public in the
 * same way `/events` is: no bearer token here, only `EXCLUDED_IPS`. That's a
 * deliberate asymmetry with the recorder-receiver's write token: worst-case
 * abuse here is a handful of small extra DynamoDB writes within the
 * provisioned free-tier capacity, not disk exhaustion on owned hardware.
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

  const meta = parseSessionRecordingMeta(event.body);
  if (!meta) {
    // Same reasoning as rollup-handler.ts's per-run logging: a missing
    // dashboard datapoint should be one CloudWatch query away from being
    // explained, not a silent black box. bodyLength only, not the payload
    // itself — this endpoint is public, nothing on it is trusted, so keep
    // logging minimal even though this particular shape has no PII.
    console.log(JSON.stringify({ sessionMeta: { status: "invalid", bodyLength: event.body?.length ?? 0 } }));
    return { statusCode: 400, headers, body: "Invalid payload" };
  }

  const sourceIp = event.requestContext.http.sourceIp;
  if (isIpExcluded(sourceIp, EXCLUDED_IPS)) {
    console.log(JSON.stringify({ sessionMeta: { status: "excluded", siteId: meta.siteId } }));
    return { statusCode: 204, headers };
  }

  // Same enrichment as handler.ts's pageview/custom-event path — derived
  // from headers, never trusted from the client. This is what makes a
  // session recording joinable to the same visitor/geo/device breakdown the
  // pageview side already has, without ever persisting the raw IP/UA.
  const userAgent = event.headers["user-agent"] ?? "";
  const visitorHash = computeVisitorHash(sourceIp, userAgent);
  const country = resolveCountry(event.headers["cloudfront-viewer-country"]);
  const device = classifyDevice(userAgent);

  await putSessionRecordingMeta({ ...meta, visitorHash, country, device });
  console.log(JSON.stringify({ sessionMeta: { status: "wrote", siteId: meta.siteId, sessionId: meta.sessionId, durationMs: meta.durationMs, pageCount: meta.pageCount } }));

  return { statusCode: 204, headers };
}
