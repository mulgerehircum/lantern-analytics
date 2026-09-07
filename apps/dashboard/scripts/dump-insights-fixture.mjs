// One-shot fixture dump for the AI-insights eval harness (eval/insights/).
// Reads raw DynamoDB items for one site - AGG# rollups (all-time), the
// current live hour's raw EVENT# items, and SESSION# recordings - and
// writes them as one JSON file the eval bootstrap turns into exactly the
// summaries the production dashboard would render.
//
// Why raw items and not precomputed summaries: the eval must exercise the
// SAME pure production functions (summarizeRollups / summarizeSessions /
// buildInsightSignals) the page uses, or it isn't testing production.
//
// Own DynamoDB client instance rather than importing lib/dynamodb.ts's
// cached exports: those are wrapped in unstable_cache, which only works
// inside a Next.js request context - same deliberate-duplication
// precedent as lib/sessions.ts (see its header comment).
//
// Usage: node scripts/dump-insights-fixture.mjs <siteId> [outFile]
//   outFile defaults to eval/insights/fixtures/<siteId>.json

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const TABLE_NAME = process.env.EVENTS_TABLE_NAME ?? "lantern-events";
const REGION = process.env.LANTERN_AWS_REGION ?? "eu-central-1";

const credentials =
  process.env.LANTERN_AWS_ACCESS_KEY_ID && process.env.LANTERN_AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.LANTERN_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.LANTERN_AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION, credentials }));

async function queryAll(pk, skPrefix, scanForward = true) {
  const items = [];
  let lastKey;
  do {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": pk, ":sk": skPrefix },
        ExclusiveStartKey: lastKey,
        ...(scanForward ? {} : { ScanIndexForward: false }),
      }),
    );
    items.push(...(result.Items ?? []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

const siteId = process.argv[2];
if (!siteId) {
  console.error("Usage: node scripts/dump-insights-fixture.mjs <siteId> [outFile]");
  process.exit(1);
}
const outFile =
  process.argv[3] ?? path.resolve(import.meta.dirname, "../eval/insights/fixtures", `${siteId}.json`);

const currentHourPrefix = new Date().toISOString().slice(0, 13);

const [rollups, liveEvents, sessions] = await Promise.all([
  queryAll(`SITE#${siteId}`, "AGG#"),
  queryAll(`SITE#${siteId}`, `EVENT#${currentHourPrefix}`),
  queryAll(`SITE#${siteId}`, "SESSION#", false),
]);

const fixture = {
  siteId,
  dumpedAt: new Date().toISOString(),
  source: "dynamodb",
  items: { rollups, liveEvents, sessions },
};

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify(fixture, null, 2) + "\n");
console.log(
  `Dumped ${siteId}: ${rollups.length} rollups, ${liveEvents.length} live events, ${sessions.length} sessions -> ${outFile}`,
);
