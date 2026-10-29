import { NextResponse } from "next/server";
import { answerQuestion, parseThreshold } from "@/lib/chat";
import { getDataset } from "@/lib/dataset";
import { buildIndex } from "@/lib/matching";
import type { MatchIndex } from "@/lib/matching";
import { checkSafety } from "@/lib/safety";
import { checkRateLimit, validateChatRequest } from "@/lib/validation";
import { generateOpenAIAnswer, OpenAIRequestError } from "@/lib/openai";
import type { ApiError, ChatResponse, LoadedDataset } from "@/types/healthcare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let indexCache: { dataset: LoadedDataset; index: MatchIndex } | null = null;

async function getIndex() {
  const dataset = await getDataset();
  if (!indexCache || indexCache.dataset !== dataset) indexCache = { dataset, index: buildIndex(dataset.records) };
  return indexCache;
}

const json = (body: ChatResponse | ApiError, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!checkRateLimit(ip)) return json({ error: "Too many requests. Please wait a moment and try again." }, 429);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Request body must be valid JSON." }, 400);
    }
    const parsed = validateChatRequest(body);
    if (!parsed.ok) return json({ error: parsed.error }, parsed.status);

    // Safety rules run first and never wait on the dataset.
    const safety = checkSafety(parsed.message);
    if (safety.blocking && safety.response) {
      return json({ id: crypto.randomUUID(), ...safety.response });
    }

    const { dataset, index } = await getIndex();
    const threshold = parseThreshold(process.env.MATCH_CONFIDENCE_THRESHOLD);
    const answer = answerQuestion(parsed.message, dataset, index, threshold);
    if (answer.matchType !== "fallback" || !process.env.OPENAI_API_KEY) return json(answer);

    try {
      const generated = await generateOpenAIAnswer(parsed.message);
      if (!generated) return json(answer);
      return json({
        ...answer,
        answer: `${safety.notice ? `${safety.notice}\n\n` : ""}${generated}`,
        matchType: "ai",
      });
    } catch (err) {
      if (err instanceof OpenAIRequestError) {
        console.error("OpenAI answer generation failed.");
        return json({ error: "The AI answer service is temporarily unavailable. Please try again later. If this is urgent, call 112." }, 502);
      }
      throw err;
    }
  } catch (err) {
    // Log only the error type: never the user's message, which may contain health information.
    console.error("chat route error:", err instanceof Error ? err.name : "unknown");
    return json({ error: "Something went wrong on our side. Please try again. If this is urgent, call 112." }, 500);
  }
}
