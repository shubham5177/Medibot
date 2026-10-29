// Applies database/schema.sql and imports the configured dataset into Turso/libSQL.
// Usage: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:seed
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { parseCsv } from "../lib/csv-parser.mjs";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN for remote databases) first.");
  process.exit(1);
}
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const schema = readFileSync(new URL("../database/schema.sql", import.meta.url), "utf8");
await db.executeMultiple(schema);

const dataPath = path.resolve(process.env.DATASET_PATH ?? "data/medipot_healthcare_dataset_2000.csv");
const text = readFileSync(dataPath, "utf8");
const isCsv = dataPath.toLowerCase().endsWith(".csv");
const data = isCsv ? null : JSON.parse(text);
const records = isCsv ? parseCsv(text) : Array.isArray(data) ? data : data.records;
const version = isCsv ? path.basename(dataPath, ".csv") : data.meta?.version ?? "unversioned";

const tx = await db.transaction("write");
try {
  const v = await tx.execute({ sql: "INSERT INTO dataset_versions (version, record_count, notes) VALUES (?, ?, ?)", args: [version, records.length, "seed script"] });
  await tx.execute("DELETE FROM healthcare_records");
  for (const r of records) {
    const record = isCsv
      ? {
          ...r,
          symptoms: typeof r.symptoms === "string" ? r.symptoms.split("|").map((s) => s.trim()).filter(Boolean) : [],
          keywords: typeof r.keywords === "string" ? r.keywords.split("|").map((s) => s.trim()).filter(Boolean) : [],
          sourceUrl: r.sourceUrl || null,
          lastReviewed: /^\d{4}-\d{2}-\d{2}$/.test(r.lastReviewed ?? "") ? r.lastReviewed : null,
          reviewStatus: r.reviewStatus === "reviewed" && /^\d{4}-\d{2}-\d{2}$/.test(r.lastReviewed ?? "") ? "reviewed" : "sample-unreviewed",
        }
      : r;
    await tx.execute({
      sql: "INSERT INTO healthcare_records (id, question, symptoms, keywords, category, answer, source, source_url, urgency, last_reviewed, review_status, dataset_version_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [record.id, record.question, JSON.stringify(record.symptoms ?? []), JSON.stringify(record.keywords ?? []), record.category, record.answer, record.source, record.sourceUrl ?? null, record.urgency ?? "routine", record.lastReviewed ?? null, record.reviewStatus ?? "sample-unreviewed", Number(v.lastInsertRowid)],
    });
  }
  await tx.commit();
  console.log(`Imported ${records.length} records (dataset version ${version}).`);
} catch (err) {
  await tx.rollback();
  console.error("Import failed:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  tx.close();
}
