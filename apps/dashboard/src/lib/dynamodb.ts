import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.EVENTS_TABLE_NAME ?? "lantern-events";
const REGION = process.env.LANTERN_AWS_REGION ?? "eu-central-1";

// Custom env var names, not the standard AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY:
// Vercel Functions run on AWS Lambda under the hood, and Lambda's runtime
// reserves those exact names for its OWN execution role — a Vercel-set env
// var with the standard name would be shadowed/ignored. Explicit credentials
// only when the custom vars are present (i.e. on Vercel); otherwise fall
// back to the SDK's default provider chain, which resolves from
// ~/.aws/credentials locally. The key behind these vars is intentionally
// scoped to Query/GetItem on this one table — never the admin key used for
// CDK deploys.
const credentials =
  process.env.LANTERN_AWS_ACCESS_KEY_ID && process.env.LANTERN_AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.LANTERN_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.LANTERN_AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

// Server-side only — this module (and the credentials it uses) must never be
// imported from a client component. Every caller in this app is a Server
// Component or a route handler, never client code.
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION, credentials }));

export interface HourlyRollupItem {
  SK: string; // "AGG#2026-08-08#11"
  pageviews: number;
  uniques: number;
  topPages: Record<string, number>;
  referrers: Record<string, number>;
  countries: Record<string, number>;
  devices: Record<string, number>;
}

/**
 * One `PK + SK begins_with` query, never a Scan — see
 * packages/ingestion/docs/dynamodb-schema.md for why that matters.
 */
export async function getHourlyRollups(siteId: string): Promise<HourlyRollupItem[]> {
  const result = await client.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `SITE#${siteId}`,
        ":sk": "AGG#",
      },
    }),
  );
  return (result.Items ?? []) as HourlyRollupItem[];
}

export interface RawEventRecord {
  path: string;
  referrer: string;
  country: string;
  device: string;
  visitorHash: string;
}

// Mirrors packages/ingestion/src/rollup-store.ts's hourPrefix() — kept as a
// tiny local inline rather than a cross-package import for one string op.
function currentHourPrefix(): string {
  return new Date().toISOString().slice(0, 13);
}

/**
 * The "live" read path (see docs/design.md): queries raw EVENT# items for
 * the CURRENT, still-incomplete hour only. This can never double-count
 * against the AGG# rollups, because the rollup Lambda only ever processes
 * the previous complete hour — the current hour is, by construction, always
 * live-only until it becomes the "previous" hour on the next scheduled run.
 * Cheap by design: bounded to one hour's worth of events, same query shape
 * the rollup itself uses, just targeting "now" instead of "an hour ago".
 */
export async function getLiveRawEvents(siteId: string): Promise<RawEventRecord[]> {
  const result = await client.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `SITE#${siteId}`,
        ":sk": `EVENT#${currentHourPrefix()}`,
      },
    }),
  );
  return (result.Items ?? []) as RawEventRecord[];
}

/** "AGG#2026-08-08#13" for the current hour — matches the real rollup SK format. */
export function currentHourSK(): string {
  const [date, hourPart] = currentHourPrefix().split("T");
  return `AGG#${date}#${hourPart}`;
}
