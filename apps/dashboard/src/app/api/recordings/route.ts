import { NextRequest, NextResponse } from "next/server";
import { getSessionRecordings } from "@/lib/sessions";

/**
 * The dashboard's first-ever API route, and its first-ever outbound fetch
 * that isn't the AWS SDK talking to DynamoDB. Deliberately server-side only:
 * the Mac-mini receiver's URL and read token (RECORDING_RECEIVER_URL,
 * RECORDING_READ_TOKEN) must never reach the browser — see
 * apps/dashboard/docs/design.md's Phase 2 addition note. ReplayPlayer (a
 * client component, since rrweb-player needs a real DOM) calls this route
 * instead of the receiver directly.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const siteId = request.nextUrl.searchParams.get("siteId");
  const sessionId = request.nextUrl.searchParams.get("sessionId");

  if (!siteId || !sessionId) {
    return NextResponse.json({ error: "siteId and sessionId are required" }, { status: 400 });
  }

  // Resolve storageRef server-side from DynamoDB rather than trusting
  // anything client-supplied — same defense-in-depth as
  // packages/ingestion/src/session-meta-validate.ts, which computes
  // storageRef itself rather than accepting one from the ingest payload.
  const sessions = await getSessionRecordings(siteId);
  const session = sessions.find((s) => s.sessionId === sessionId);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  const receiverUrl = process.env.RECORDING_RECEIVER_URL;
  const readToken = process.env.RECORDING_READ_TOKEN;
  if (!receiverUrl || !readToken) {
    return NextResponse.json({ error: "recording storage is not configured" }, { status: 503 });
  }

  const upstream = await fetch(`${receiverUrl.replace(/\/$/, "")}/${session.storageRef}`, {
    headers: { Authorization: `Bearer ${readToken}` },
    // Recordings can be a few MB; never let Next's fetch cache hold onto them.
    cache: "no-store",
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: "recording not found on receiver" }, { status: upstream.status });
  }

  const body = await upstream.json();
  return NextResponse.json(body);
}
