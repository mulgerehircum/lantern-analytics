import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.EVENTS_TABLE_NAME ?? "lantern-events";

// Server-side only — this module (and the credentials it uses) must never be
// imported from a client component. Every caller in this app is a Server
// Component or a route handler, never client code.
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

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
