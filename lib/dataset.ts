import { readFile } from "node:fs/promises";
import path from "node:path";
import { CATEGORIES } from "../types/healthcare.ts";
import type { CategorySummary, DatasetIssue, HealthcareRecord, LoadedDataset } from "../types/healthcare.ts";
import { validateRecord } from "./validation.ts";
import { parseCsv } from "./csv-parser.mjs";

export { parseCsv } from "./csv-parser.mjs";

/** Lower-cases and strips punctuation so near-identical questions compare equal. */
export function dedupeKey(question: string): string {
  return question.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/** Validates raw rows, drops invalid ones and removes duplicate questions / ids. */
export function buildDataset(rawRows: unknown[], version = "unversioned", origin: LoadedDataset["origin"] = "file"): LoadedDataset {
  const issues: DatasetIssue[] = [];
  const records: HealthcareRecord[] = [];
  const seenQuestions = new Map<string, string>();
  const seenIds = new Set<string>();
  rawRows.forEach((raw, index) => {
    const result = validateRecord(raw, index);
    issues.push(...result.issues);
    const rec = result.record;
    if (!rec) return;
    const key = dedupeKey(rec.question);
    if (seenQuestions.has(key)) {
      issues.push({ index, id: rec.id, severity: "warning", message: `Duplicate of '${seenQuestions.get(key)}'; skipped.` });
      return;
    }
    if (seenIds.has(rec.id)) {
      issues.push({ index, id: rec.id, severity: "warning", message: "Duplicate id; skipped." });
      return;
    }
    seenQuestions.set(key, rec.id);
    seenIds.add(rec.id);
    records.push(rec);
  });
  return { records, issues, version, origin };
}

/** Parses dataset file contents (.json or .csv) into a validated dataset. */
export function parseDatasetText(text: string, format: "json" | "csv"): LoadedDataset {
  if (format === "csv") return buildDataset(parseCsv(text), "csv");
  const parsed: unknown = JSON.parse(text);
  if (Array.isArray(parsed)) return buildDataset(parsed);
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown }).records)) {
    const meta = (parsed as { meta?: { version?: unknown } }).meta;
    return buildDataset((parsed as { records: unknown[] }).records, typeof meta?.version === "string" ? meta.version : "unversioned");
  }
  throw new Error("Dataset JSON must be an array or an object with a 'records' array.");
}

export async function loadDatasetFile(filePath: string): Promise<LoadedDataset> {
  const text = await readFile(filePath, "utf8");
  return parseDatasetText(text, filePath.toLowerCase().endsWith(".csv") ? "csv" : "json");
}

export function defaultDatasetPath(): string {
  return process.env.DATASET_PATH
    ? path.resolve(process.env.DATASET_PATH)
    : path.join(process.cwd(), "data", "medipot_healthcare_dataset_2000.csv");
}

let cache: Promise<LoadedDataset> | null = null;

/**
 * Loads the dataset on the server. Tries Turso first when configured, then the local file.
 * Never throws: failures resolve to an empty dataset with an error issue.
 */
export function getDataset(): Promise<LoadedDataset> {
  if (!cache) {
    cache = (async (): Promise<LoadedDataset> => {
      try {
        if (process.env.TURSO_DATABASE_URL) {
          const { fetchRawRecords } = await import("./database.ts");
          const raw = await fetchRawRecords();
          if (raw && raw.rows.length > 0) {
            const fromDb = buildDataset(raw.rows, raw.version, "database");
            if (fromDb.records.length > 0) return fromDb;
          }
        }
      } catch {
        // fall through to the local file
      }
      try {
        return await loadDatasetFile(defaultDatasetPath());
      } catch (err) {
        const name = err instanceof Error ? err.name : "Error";
        return { records: [], version: "none", origin: "file", issues: [{ index: -1, severity: "error", message: `Dataset could not be loaded (${name}).` }] };
      }
    })();
  }
  return cache;
}

/** Test/maintenance helper. */
export function resetDatasetCache(): void {
  cache = null;
}

export function summarizeCategories(records: HealthcareRecord[], perCategory = 4): CategorySummary[] {
  return CATEGORIES.map((category) => {
    const inCat = records.filter((r) => r.category === category);
    return { category, count: inCat.length, questions: inCat.slice(0, perCategory).map((r) => r.question) };
  }).filter((c) => c.count > 0);
}
