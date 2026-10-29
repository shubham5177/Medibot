import { CATEGORIES, URGENCIES } from "../types/healthcare.ts";
import type { Category, DatasetIssue, HealthcareRecord, Urgency, ReviewStatus } from "../types/healthcare.ts";

export const MAX_MESSAGE_LENGTH = 500;

export type ChatRequestResult =
  | { ok: true; message: string }
  | { ok: false; status: number; error: string };

/** Validates the JSON body of POST /api/chat. */
export function validateChatRequest(body: unknown): ChatRequestResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Request body must be a JSON object." };
  }
  const message = (body as Record<string, unknown>).message;
  if (typeof message !== "string") {
    return { ok: false, status: 400, error: "Field 'message' must be a string." };
  }
  // eslint-disable-next-line no-control-regex
  const cleaned = message.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (cleaned.length === 0) {
    return { ok: false, status: 400, error: "Please type a question." };
  }
  if (cleaned.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, status: 413, error: `Please keep your question under ${MAX_MESSAGE_LENGTH} characters.` };
  }
  return { ok: true, message: cleaned };
}

export type FeedbackRequestResult =
  | { ok: true; messageId: string; recordId: string | null; helpful: boolean }
  | { ok: false; status: number; error: string };

export function validateFeedbackRequest(body: unknown): FeedbackRequestResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Request body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;
  const idOk = (v: unknown): v is string => typeof v === "string" && /^[\w-]{1,64}$/.test(v);
  if (!idOk(b.messageId)) return { ok: false, status: 400, error: "Invalid 'messageId'." };
  if (typeof b.helpful !== "boolean") return { ok: false, status: 400, error: "Field 'helpful' must be a boolean." };
  if (b.recordId != null && !idOk(b.recordId)) return { ok: false, status: 400, error: "Invalid 'recordId'." };
  return { ok: true, messageId: b.messageId, recordId: (b.recordId as string | null | undefined) ?? null, helpful: b.helpful };
}

// ---- Simple in-memory rate limiter (best effort; per server instance) ----
const hits = new Map<string, number[]>();
export function checkRateLimit(key: string, limit = 30, windowMs = 60_000, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  }
  return true;
}

// ---- Dataset record validation ----
const asString = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const asList = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map(asString).filter(Boolean)
    : typeof v === "string"
      ? v.split("|").map((s) => s.trim()).filter(Boolean)
      : [];

/**
 * Validates one raw dataset row. Rows missing a question, answer or source are rejected
 * (an answer without a source is never shown). Other gaps get safe defaults plus a warning.
 */
export function validateRecord(
  raw: unknown,
  index: number,
): { record: HealthcareRecord | null; issues: DatasetIssue[] } {
  const issues: DatasetIssue[] = [];
  if (typeof raw !== "object" || raw === null) {
    return { record: null, issues: [{ index, severity: "error", message: "Row is not an object." }] };
  }
  const r = raw as Record<string, unknown>;
  const id = asString(r.id) || `row-${index + 1}`;
  if (!asString(r.id)) issues.push({ index, id, severity: "warning", message: "Missing id; generated one." });

  const question = asString(r.question);
  const answer = asString(r.answer);
  const source = asString(r.source);
  for (const [name, value] of [["question", question], ["answer", answer], ["source", source]] as const) {
    if (!value) issues.push({ index, id, severity: "error", message: `Missing required field '${name}'; row skipped.` });
  }
  if (!question || !answer || !source) return { record: null, issues };

  let category = asString(r.category) as Category;
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    issues.push({ index, id, severity: "warning", message: `Unknown category '${category}'; using 'General healthcare'.` });
    category = "General healthcare";
  }
  let urgency = asString(r.urgency) as Urgency;
  if (!URGENCIES.includes(urgency)) {
    if (urgency) issues.push({ index, id, severity: "warning", message: `Unknown urgency '${urgency}'; using 'routine'.` });
    urgency = "routine";
  }
  const reviewStatus: ReviewStatus = asString(r.reviewStatus) === "reviewed" ? "reviewed" : "sample-unreviewed";
  const lastReviewedRaw = asString(r.lastReviewed);
  const lastReviewed = /^\d{4}-\d{2}-\d{2}$/.test(lastReviewedRaw) ? lastReviewedRaw : null;
  if (reviewStatus === "reviewed" && !lastReviewed) {
    issues.push({ index, id, severity: "warning", message: "Marked reviewed but has no valid lastReviewed date." });
  }
  const sourceUrl = asString(r.sourceUrl);
  return {
    record: {
      id, question, answer, source, category, urgency, reviewStatus, lastReviewed,
      symptoms: asList(r.symptoms),
      keywords: asList(r.keywords),
      ...(/^https?:\/\//.test(sourceUrl) ? { sourceUrl } : {}),
    },
    issues,
  };
}
