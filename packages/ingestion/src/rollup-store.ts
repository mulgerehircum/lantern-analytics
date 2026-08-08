import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { HourlyRollup, RawEventItem } from "./aggregate";

const TABLE_NAME = process.env.EVENTS_TABLE_NAME ?? "lantern-events";
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/** "2026-08-08T14" — the SK prefix shared by every raw event in that hour. */
export function hourPrefix(date: Date): string {
  return date.toISOString().slice(0, 13);
}

export async function queryRawEventsForHour(
  siteId: string,
  hour: string,
): Promise<RawEventItem[]> {
  const result = await client.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `SITE#${siteId}`,
        ":skPrefix": `EVENT#${hour}`,
      },
    }),
  );
  return (result.Items ?? []) as RawEventItem[];
}

/** Writes the permanent AGG# item. No TTL — unlike raw events, this is the record that stays. */
export async function putHourlyRollup(
  siteId: string,
  hour: string,
  rollup: HourlyRollup,
): Promise<void> {
  const [date, hourPart] = hour.split("T");
  await client.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `SITE#${siteId}`,
        SK: `AGG#${date}#${hourPart}`,
        ...rollup,
      },
    }),
  );
}
