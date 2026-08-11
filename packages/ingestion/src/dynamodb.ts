import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { EnrichedCustomEvent, EnrichedPageviewEvent, SessionRecordingMeta } from "@lantern/shared";

const TABLE_NAME = process.env.EVENTS_TABLE_NAME ?? "lantern-events";
const RAW_EVENT_TTL_DAYS = 30;

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Six hex chars is plenty of entropy to keep SK unique within the same
// millisecond; this is not a security-sensitive identifier.
function randomEventId(): string {
  return Math.random().toString(16).slice(2, 8);
}

/**
 * Writes one raw EVENT# item. See docs/dynamodb-schema.md for the item shape
 * and why raw events carry a TTL while rollups (written separately, by the
 * rollup Lambda) don't. Custom events carry `name`/`metadata`; pageviews omit
 * both, which keeps the pre-existing aggregate/rollup code untouched.
 */
export async function putRawEvent(event: EnrichedPageviewEvent | EnrichedCustomEvent): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + RAW_EVENT_TTL_DAYS * 24 * 60 * 60;

  const item: Record<string, unknown> = {
    PK: `SITE#${event.siteId}`,
    SK: `EVENT#${event.timestamp}#${randomEventId()}`,
    path: event.path,
    country: event.country,
    device: event.device,
    visitorHash: event.visitorHash,
    ttl,
  };

  if ("name" in event) {
    item.name = event.name;
    item.metadata = event.metadata;
  } else {
    item.referrer = event.referrer;
  }

  await client.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    }),
  );
}

/**
 * Writes/updates one SESSION# item — repeated metadata heartbeats during a
 * long session all target the same PK+SK (fixed `startedAt` in the SK). No
 * TTL: this is the permanent record, like AGG# rollups, not a disposable raw
 * event. See docs/dynamodb-schema.md.
 *
 * An `UpdateCommand` rather than a plain overwrite: `durationMs`/`pageCount`/
 * `country`/`device`/`visitorHash` should reflect the latest heartbeat, but
 * `path`/`referrer` are landing-page values — meaningful only from the
 * session's FIRST heartbeat. A later heartbeat (from a second page, if the
 * session spans more than one) must never clobber them with wherever the
 * visitor is now. `if_not_exists` gives that "first write wins" semantic
 * without the handler needing to know whether this is a new session.
 */
export async function putSessionRecordingMeta(meta: SessionRecordingMeta): Promise<void> {
  await client.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `SITE#${meta.siteId}`,
        SK: `SESSION#${meta.startedAt}#${meta.sessionId}`,
      },
      UpdateExpression:
        "SET sessionId = :sessionId, startedAt = :startedAt, durationMs = :durationMs, pageCount = :pageCount, storageRef = :storageRef, " +
        "country = :country, device = :device, visitorHash = :visitorHash, " +
        "#path = if_not_exists(#path, :path), referrer = if_not_exists(referrer, :referrer)",
      // "path" is a reserved word in DynamoDB's expression grammar.
      ExpressionAttributeNames: { "#path": "path" },
      ExpressionAttributeValues: {
        ":sessionId": meta.sessionId,
        ":startedAt": meta.startedAt,
        ":durationMs": meta.durationMs,
        ":pageCount": meta.pageCount,
        ":storageRef": meta.storageRef,
        ":country": meta.country,
        ":device": meta.device,
        ":visitorHash": meta.visitorHash,
        ":path": meta.path,
        ":referrer": meta.referrer,
      },
    }),
  );
}
