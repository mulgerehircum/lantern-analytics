import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
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
 * Writes/overwrites one SESSION# item — repeated metadata heartbeats during a
 * long session are simple overwrites of the same PK+SK (fixed `startedAt` in
 * the SK), not atomic counter updates, matching the project's existing
 * simple-write style. No TTL: this is the permanent record, like AGG#
 * rollups, not a disposable raw event. See docs/dynamodb-schema.md.
 */
export async function putSessionRecordingMeta(meta: SessionRecordingMeta): Promise<void> {
  await client.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `SITE#${meta.siteId}`,
        SK: `SESSION#${meta.startedAt}#${meta.sessionId}`,
        sessionId: meta.sessionId,
        startedAt: meta.startedAt,
        durationMs: meta.durationMs,
        pageCount: meta.pageCount,
        storageRef: meta.storageRef,
      },
    }),
  );
}
