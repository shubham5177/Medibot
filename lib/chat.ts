import type { ChatResponse, LoadedDataset } from "../types/healthcare.ts";
import { DEFAULT_THRESHOLD, searchIndex } from "./matching.ts";
import type { MatchIndex } from "./matching.ts";
import { checkSafety } from "./safety.ts";

export function parseThreshold(raw: string | undefined): number {
  const n = Number(raw);
  return raw !== undefined && raw !== "" && Number.isFinite(n) && n >= 0 && n <= 1 ? n : DEFAULT_THRESHOLD;
}

const FALLBACK =
  "I couldn't find a reliable answer to that in my dataset, so I don't want to guess. Could you rephrase your question, or ask about a specific symptom, food, habit or first-aid situation?\nFor anything that worries you, a doctor or pharmacist is the right person to ask. If it could be an emergency, call 112.";

const newId = () => globalThis.crypto.randomUUID();

/**
 * Full answer pipeline: safety rules first (never waits on the dataset), then retrieval.
 * `dataset` and `index` are only used when the safety module does not block.
 */
export function answerQuestion(
  message: string,
  dataset: LoadedDataset,
  index: MatchIndex,
  threshold: number,
): ChatResponse {
  const safety = checkSafety(message);
  if (safety.blocking && safety.response) return { id: newId(), ...safety.response };

  const outcome = searchIndex(index, message, { threshold });
  const prefix = safety.notice ? `${safety.notice}\n\n` : "";
  const related = outcome.related.map((c) => ({ id: c.record.id, question: c.record.question }));

  if (outcome.status === "match" && outcome.best) {
    const { record, confidence } = outcome.best;
    return {
      id: newId(),
      answer: prefix + record.answer,
      category: record.category,
      source: { name: record.source, ...(record.sourceUrl ? { url: record.sourceUrl } : {}) },
      confidence: Math.round(confidence * 100) / 100,
      urgency: record.urgency,
      needsProfessionalCare: record.urgency === "see-doctor" || record.urgency === "emergency",
      matchType: "dataset",
      reviewStatus: record.reviewStatus,
      recordId: record.id,
      related: related.slice(0, outcome.ambiguous ? 3 : 2),
    };
  }

  const unavailable = outcome.status === "empty-dataset";
  return {
    id: newId(),
    answer: prefix + (unavailable
      ? "My health information dataset isn't available right now, so I can't answer questions yet. Please try again later. If this could be an emergency, call 112."
      : FALLBACK),
    category: null,
    source: null,
    confidence: 0,
    urgency: "routine",
    needsProfessionalCare: false,
    matchType: "fallback",
    reviewStatus: null,
    recordId: null,
    related,
  };
}
