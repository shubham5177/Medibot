import type { HealthcareRecord } from "../types/healthcare.ts";

/**
 * Dataset retrieval engine: TF-IDF + cosine similarity over weighted fields.
 * Pure functions, no I/O and no UI imports, so the method can be swapped out later
 * (for example with embeddings) without touching the interface.
 */

export const DEFAULT_THRESHOLD = 0.3;

const STOP_WORDS = new Set(
  ("a an the is are was were be been am do does did can could should would will shall may might i me my mine we our you your " +
    "it its of to in on at for with and or but if so as by from about into than then that this these those what which who whom " +
    "how when where why there their them they he she his her please tell any some much many very just also get got have has had " +
    "not up out over under again too really week weeks better keep keeping getting going go away stay always never each every tip tips way ways need needs want like").split(" "),
);

/** Phrase-level rewrites applied before tokenizing. */
const PHRASES: [RegExp, string][] = [
  [/\bthrowing up\b/g, "vomiting"],
  [/\bloose motions?\b/g, "diarrhoea"],
  [/\b(high |low )?bp\b/g, "blood pressure"],
  [/\bhead ?ache(s)?\b/g, "headache"],
  [/\bwork ?out(s)?\b/g, "exercise"],
  [/\bcheck ?up(s)?\b/g, "checkup"],
];

/** Word-level synonyms mapped to one canonical form. */
const SYNONYMS: Record<string, string> = {
  tummy: "stomach", belly: "stomach", abdomen: "stomach", abdominal: "stomach",
  diarrhea: "diarrhoea", anemia: "anaemia", anemic: "anaemia", tired: "fatigue", tiredness: "fatigue",
  exhausted: "fatigue", exhaustion: "fatigue", sleepy: "fatigue", dehydrated: "dehydration",
  hydrated: "hydration", medication: "medicine", tablet: "medicine", pills: "medicine", pill: "medicine", drug: "medicine",
  physician: "doctor", gp: "doctor", workout: "exercise", fitness: "exercise", temperature: "fever",
  feverish: "fever", lightheaded: "dizzy", dizziness: "dizzy", vertigo: "dizzy", insomnia: "sleep",
  sleeping: "sleep", immunization: "vaccine", immunisation: "vaccine", vaccination: "vaccine", vaccinations: "vaccine",
  stressed: "stress", anxious: "anxiety", worried: "anxiety", sad: "depression", hurts: "pain", hurt: "pain", hurting: "pain", ache: "pain", aching: "pain", sore: "pain",
};

/** Very light suffix stripper; applied identically to dataset and queries so forms line up. */
export function stem(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else if (w.length > 3 && w.endsWith("s") && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed") && !w.endsWith("eed")) w = w.slice(0, -2);
  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

export function normalize(text: string): string {
  let t = text.toLowerCase().replace(/[’‘]/g, "'");
  for (const [re, rep] of PHRASES) t = t.replace(re, rep);
  return t.replace(/'/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const raw of normalize(text).split(" ")) {
    if (!raw || STOP_WORDS.has(raw)) continue;
    if (raw.length < 2 && !/\d/.test(raw)) continue;
    out.push(stem(SYNONYMS[raw] ?? raw));
  }
  return out;
}

const FIELD_WEIGHTS = { question: 3, keywords: 2, symptoms: 2, category: 1 } as const;

interface IndexedDoc {
  record: HealthcareRecord;
  weights: Map<string, number>; // term -> tf*idf
  norm: number;
  questionKey: string;
}

export interface MatchIndex {
  docs: IndexedDoc[];
  idf: Map<string, number>;
  unknownIdf: number;
}

export function buildIndex(records: HealthcareRecord[]): MatchIndex {
  const tfs = records.map((record) => {
    const tf = new Map<string, number>();
    const add = (text: string, w: number) => {
      for (const t of tokenize(text)) tf.set(t, (tf.get(t) ?? 0) + w);
    };
    add(record.question, FIELD_WEIGHTS.question);
    record.keywords.forEach((k) => add(k, FIELD_WEIGHTS.keywords));
    record.symptoms.forEach((s) => add(s, FIELD_WEIGHTS.symptoms));
    add(record.category, FIELD_WEIGHTS.category);
    return tf;
  });
  const df = new Map<string, number>();
  tfs.forEach((tf) => tf.forEach((_, t) => df.set(t, (df.get(t) ?? 0) + 1)));
  const n = records.length;
  const idf = new Map<string, number>();
  df.forEach((d, t) => idf.set(t, Math.log((n + 1) / (d + 1)) + 1));
  const docs = records.map((record, i) => {
    const weights = new Map<string, number>();
    let sumSq = 0;
    tfs[i].forEach((tf, t) => {
      const w = (1 + Math.log(tf)) * (idf.get(t) ?? 1);
      weights.set(t, w);
      sumSq += w * w;
    });
    return { record, weights, norm: Math.sqrt(sumSq), questionKey: normalize(record.question) };
  });
  return { docs, idf, unknownIdf: 1 };
}

export interface Candidate {
  record: HealthcareRecord;
  /** Raw cosine similarity, 0–1. */
  score: number;
  /** Cosine blended with weighted query-term coverage, 0–1. */
  confidence: number;
  matchedTerms: string[];
  coverage: number;
}

export interface MatchOptions {
  threshold?: number;
  maxRelated?: number;
}

export type MatchStatus = "match" | "no-match" | "empty-query" | "empty-dataset";

export interface MatchOutcome {
  status: MatchStatus;
  best: Candidate | null;
  /** Other plausible entries (for "related" or "did you mean" links). */
  related: Candidate[];
  /** True when two entries from different categories score almost equally. */
  ambiguous: boolean;
  threshold: number;
}

export function searchIndex(index: MatchIndex, query: string, opts: MatchOptions = {}): MatchOutcome {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const maxRelated = opts.maxRelated ?? 3;
  const empty = (status: MatchStatus): MatchOutcome => ({ status, best: null, related: [], ambiguous: false, threshold });
  if (index.docs.length === 0) return empty("empty-dataset");

  const qTerms = tokenize(query);
  if (qTerms.length === 0) return empty("empty-query");

  const qtf = new Map<string, number>();
  qTerms.forEach((t) => qtf.set(t, (qtf.get(t) ?? 0) + 1));
  const qWeights = new Map<string, number>();
  let qSumSq = 0;
  let totalIdf = 0;
  qtf.forEach((tf, t) => {
    const idf = index.idf.get(t) ?? index.unknownIdf; // unknown terms count as low-value words, lowering coverage
    const w = (1 + Math.log(tf)) * idf;
    qWeights.set(t, w);
    qSumSq += w * w;
    totalIdf += idf;
  });
  const qNorm = Math.sqrt(qSumSq);
  const qKey = normalize(query);

  const candidates: Candidate[] = index.docs.map((doc) => {
    let dot = 0;
    let matchedIdf = 0;
    const matchedTerms: string[] = [];
    qWeights.forEach((qw, t) => {
      const dw = doc.weights.get(t);
      if (dw) {
        dot += qw * dw;
        matchedIdf += index.idf.get(t) ?? 0;
        matchedTerms.push(t);
      }
    });
    const score = doc.norm && qNorm ? dot / (doc.norm * qNorm) : 0;
    const coverage = totalIdf ? matchedIdf / totalIdf : 0;
    let confidence = Math.min(1, 0.6 * score + 0.4 * coverage);
    if (qKey === doc.questionKey) confidence = 1;
    return { record: doc.record, score, confidence, matchedTerms, coverage };
  });
  candidates.sort((a, b) => b.confidence - a.confidence);

  const top = candidates[0];
  // A single shared keyword is never enough for a multi-word question.
  const enoughEvidence = qtf.size === 1 || top.matchedTerms.length >= 2 || top.coverage >= (qtf.size <= 3 ? 0.5 : 0.6);
  const accepted = top.confidence >= threshold && enoughEvidence;
  const relatedFloor = threshold * 0.6;
  const related = candidates
    .slice(accepted ? 1 : 0)
    .filter((c) => c.confidence >= relatedFloor && c.matchedTerms.length > 0)
    .slice(0, maxRelated);
  const second = candidates[1];
  const ambiguous =
    accepted && !!second && second.confidence >= threshold && top.confidence < 1 &&
    top.confidence - second.confidence < 0.04 && second.record.category !== top.record.category;

  return { status: accepted ? "match" : "no-match", best: accepted ? top : null, related, ambiguous, threshold };
}
