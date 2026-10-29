import type { Client } from "@libsql/client";
import type { HealthcareRecord } from "../types/healthcare.ts";

/**
 * Optional Turso/libSQL access. Server-only: never import this from a client component.
 * Credentials come from environment variables and are never sent to the browser.
 * All queries are parameterized.
 */

let clientPromise: Promise<Client | null> | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL);
}

export function getDb(): Promise<Client | null> {
  if (!isDatabaseConfigured()) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import("@libsql/client")
      .then(({ createClient }) =>
        createClient({ url: process.env.TURSO_DATABASE_URL as string, authToken: process.env.TURSO_AUTH_TOKEN }),
      )
      .catch(() => null);
  }
  return clientPromise;
}

/** Reads dataset rows in the same shape as the JSON file so they go through the same validation. */
export async function fetchRawRecords(): Promise<{ rows: unknown[]; version: string } | null> {
  const db = await getDb();
  if (!db) return null;
  const res = await db.execute(
    "SELECT r.id, r.question, r.symptoms, r.keywords, r.category, r.answer, r.source, r.source_url, r.urgency, r.last_reviewed, r.review_status, v.version AS version " +
      "FROM healthcare_records r LEFT JOIN dataset_versions v ON v.id = r.dataset_version_id ORDER BY r.id",
  );
  const parse = (s: unknown): string[] => {
    try {
      const v = JSON.parse(String(s ?? "[]"));
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  };
  const rows = res.rows.map((r) => ({
    id: r.id, question: r.question, symptoms: parse(r.symptoms), keywords: parse(r.keywords), category: r.category,
    answer: r.answer, source: r.source, sourceUrl: r.source_url ?? undefined, urgency: r.urgency,
    lastReviewed: r.last_reviewed ?? undefined, reviewStatus: r.review_status,
  }));
  const version = String(res.rows[0]?.version ?? "database");
  return { rows, version };
}

/** Replaces the stored dataset with `records` in one transaction. Used by scripts/seed-db.mjs logic. */
export async function importRecords(records: HealthcareRecord[], version: string, notes?: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured.");
  const tx = await db.transaction("write");
  try {
    const v = await tx.execute({
      sql: "INSERT INTO dataset_versions (version, record_count, notes) VALUES (?, ?, ?)",
      args: [version, records.length, notes ?? null],
    });
    const versionId = Number(v.lastInsertRowid);
    await tx.execute("DELETE FROM healthcare_records");
    for (const r of records) {
      await tx.execute({
        sql: "INSERT INTO healthcare_records (id, question, symptoms, keywords, category, answer, source, source_url, urgency, last_reviewed, review_status, dataset_version_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [r.id, r.question, JSON.stringify(r.symptoms), JSON.stringify(r.keywords), r.category, r.answer, r.source, r.sourceUrl ?? null, r.urgency, r.lastReviewed, r.reviewStatus, versionId],
      });
    }
    await tx.commit();
    return records.length;
  } catch (err) {
    await tx.rollback();
    throw err;
  } finally {
    tx.close();
  }
}

/** Stores anonymous feedback (no message text). Returns false when no database is configured. */
export async function saveFeedback(messageId: string, recordId: string | null, helpful: boolean): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.execute({
    sql: "INSERT INTO feedback (message_id, record_id, helpful) VALUES (?, ?, ?)",
    args: [messageId, recordId, helpful ? 1 : 0],
  });
  return true;
}
