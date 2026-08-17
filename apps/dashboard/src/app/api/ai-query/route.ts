import { NextRequest, NextResponse } from "next/server";
import { getHourlyRollups } from "@/lib/dynamodb";
import { summarizeRollups } from "@/lib/summarize";
import { askQuestion } from "@/lib/ai-query";

const MAX_QUESTION_LENGTH = 300;

interface AiQueryRequestBody {
  siteId?: string;
  question?: string;
  monthPrefix?: string;
}

/**
 * Server-side only, same reasoning as api/recordings/route.ts: GEMINI_API_KEY
 * never reaches the browser. Reuses the existing getHourlyRollups +
 * summarizeRollups pipeline unchanged — no new aggregation logic here, see
 * docs/design.md's Phase 3 section.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: AiQueryRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { siteId, question, monthPrefix } = body;

  if (!siteId) {
    return NextResponse.json({ error: "siteId is required" }, { status: 400 });
  }
  if (!question || !question.trim()) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `question must be ${MAX_QUESTION_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI query interface is not configured" }, { status: 503 });
  }

  const rollups = await getHourlyRollups(siteId, monthPrefix);
  const summary = summarizeRollups(rollups);

  try {
    const { answer } = await askQuestion(summary, question);
    return NextResponse.json({ answer, summary });
  } catch (err) {
    // Covers Gemini API errors, rate limiting, and quota exhaustion — all
    // surfaced the same way to the client: a clean 502, no leaking upstream
    // error internals.
    console.error("ai-query: Gemini call failed", err);
    return NextResponse.json({ error: "AI query failed, try again shortly" }, { status: 502 });
  }
}
