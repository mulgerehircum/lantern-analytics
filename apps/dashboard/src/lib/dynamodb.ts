import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.EVENTS_TABLE_NAME ?? "lantern-events";
const REGION = process.env.LANTERN_AWS_REGION ?? "eu-central-1";

// Custom env var names, not the standard AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY:
// Vercel Functions run on AWS Lambda under the hood, and Lambda's runtime
// reserves those exact names for its OWN execution role - a Vercel-set env
// var with the standard name would be shadowed/ignored. Explicit credentials
// only when the custom vars are present (i.e. on Vercel); otherwise fall
// back to the SDK's default provider chain, which resolves from
// ~/.aws/credentials locally. The key behind these vars is intentionally
// scoped to Query/GetItem on this one table - never the admin key used for
// CDK deploys.
const credentials =
  process.env.LANTERN_AWS_ACCESS_KEY_ID && process.env.LANTERN_AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.LANTERN_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.LANTERN_AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

// Server-side only - this module (and the credentials it uses) must never be
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
  /** Optional - rollups written before custom events existed lack these. */
  customEvents?: Record<string, number>;
  eventDimensions?: Record<string, Record<string, Record<string, number>>>;
}

/**
 * One `PK + SK begins_with` query, never a Scan - see
 * packages/ingestion/docs/dynamodb-schema.md for why that matters.
 *
 * `monthPrefix` narrows the query to one month ("YYYY-MM"), one day
 * ("YYYY-MM-DD"), or one exact hour ("YYYY-MM-DDTHH") - all the same
 * `begins_with(SK, "AGG#...")` shape against the existing `AGG#<date>#<hour>`
 * SK, no new item type needed. The `T`→`#` swap only ever fires for the hour
 * case (month/day strings never contain "T") - it exists purely because the
 * URL param spells an hour with "T" for readability while the stored SK
 * spells it with "#". Omit `monthPrefix` for the unbounded all-time query.
 */
export async function getHourlyRollups(siteId: string, monthPrefix?: string): Promise<HourlyRollupItem[]> {
  const skPrefix = monthPrefix ? `AGG#${monthPrefix.replace("T", "#")}` : "AGG#";
  const result = await client.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `SITE#${siteId}`,
        ":sk": skPrefix,
      },
    }),
  );
  return (result.Items ?? []) as HourlyRollupItem[];
}

export interface RawEventRecord {
  path: string;
  referrer?: string;
  country: string;
  device: string;
  visitorHash: string;
  isNewVisit?: boolean;
  name?: string;
  metadata?: Record<string, string | number | boolean>;
}

// Mirrors packages/ingestion/src/rollup-store.ts's hourPrefix() - kept as a
// tiny local inline rather than a cross-package import for one string op.
function currentHourPrefix(): string {
  return new Date().toISOString().slice(0, 13);
}

/**
 * The "live" read path (see docs/design.md): queries raw EVENT# items for
 * the CURRENT, still-incomplete hour only. This can never double-count
 * against the AGG# rollups, because the rollup Lambda only ever processes
 * the previous complete hour - the current hour is, by construction, always
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

/** "AGG#2026-08-08#13" for the current hour - matches the real rollup SK format. */
export function currentHourSK(): string {
  const [date, hourPart] = currentHourPrefix().split("T");
  return `AGG#${date}#${hourPart}`;
}

export interface RawEventRecordWithKey extends RawEventRecord {
  SK: string; // "EVENT#2026-08-08T14:32:10Z#f8e2c1" - the hour lives in here
}

/**
 * Every raw EVENT# item for a site, paginated. Used only by the filtered
 * dashboard view: AGG# rollups can't be sliced by dimension, so filters must
 * recompute from raw events (see lib/filter.ts). Coverage is bounded by the
 * 30-day raw-event TTL - once an hour is rolled up and its raw events expire,
 * dimension filtering for it is no longer possible.
 */
export async function getAllRawEvents(siteId: string): Promise<RawEventRecordWithKey[]> {
  const items: RawEventRecordWithKey[] = [];
  let lastKey: Record<string, AttributeValue> | undefined;
  do {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `SITE#${siteId}`,
          ":sk": "EVENT#",
        },
        ExclusiveStartKey: lastKey,
      }),
    );
    items.push(...((result.Items ?? []) as RawEventRecordWithKey[]));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}
