import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { parseSessionRecordingMeta } from "./session-meta-validate";
import { putSessionRecordingMeta } from "./dynamodb";
import { corsHeaders } from "./cors";
import { isIpExcluded, parseExcludedIps } from "./ip-exclude";

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
    return { statusCode: 400, headers, body: "Invalid payload" };
  }

  const sourceIp = event.requestContext.http.sourceIp;
  if (isIpExcluded(sourceIp, EXCLUDED_IPS)) {
    return { statusCode: 204, headers };
  }

  await putSessionRecordingMeta(meta);

  return { statusCode: 204, headers };
}
