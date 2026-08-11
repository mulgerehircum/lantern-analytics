import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.EVENTS_TABLE_NAME ?? "lantern-events";
const REGION = process.env.LANTERN_AWS_REGION ?? "eu-central-1";

// Same credential story as lib/dynamodb.ts — see that file's comment for why
// these are non-standard env var names. Deliberately a second client
// instance rather than importing lib/dynamodb.ts's, keeping the Phase 2
// session-recording data path independent of the Phase 1 analytics path.
const credentials =
  process.env.LANTERN_AWS_ACCESS_KEY_ID && process.env.LANTERN_AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.LANTERN_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.LANTERN_AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

// Server-side only, same rule as lib/dynamodb.ts — never import this from a
// client component.
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION, credentials }));

export interface SessionRecordingItem {
  sessionId: string;
  startedAt: string;
  durationMs: number;
  pageCount: number;
  storageRef: string;
}

/**
 * One `PK + SK begins_with` query, newest-first — same free-tier-friendly
 * shape as every other query in this app, no GSI. See
 * packages/ingestion/docs/dynamodb-schema.md for the SESSION# item shape.
 */
export async function getSessionRecordings(siteId: string): Promise<SessionRecordingItem[]> {
  const result = await client.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `SITE#${siteId}`,
        ":sk": "SESSION#",
      },
      ScanIndexForward: false,
    }),
  );
  return (result.Items ?? []) as SessionRecordingItem[];
}
