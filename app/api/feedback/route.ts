import { NextResponse } from "next/server";
import { saveFeedback } from "@/lib/database";
import { checkRateLimit, validateFeedbackRequest } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Anonymous Helpful / Not helpful votes. Stores no message text. Without Turso it is a no-op. */
export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!checkRateLimit(`fb:${ip}`, 60)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    const parsed = validateFeedbackRequest(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    const stored = await saveFeedback(parsed.messageId, parsed.recordId, parsed.helpful).catch(() => false);
    return NextResponse.json({ ok: true, stored });
  } catch {
    return NextResponse.json({ error: "Could not record feedback." }, { status: 500 });
  }
}
