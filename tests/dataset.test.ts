import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildDataset, defaultDatasetPath, loadDatasetFile, parseCsv, parseDatasetText, summarizeCategories, getDataset, resetDatasetCache } from "../lib/dataset.ts";

const good = { id: "a1", question: "What is X?", answer: "X is Y.", source: "WHO", category: "General healthcare" };

test("missing required fields are skipped with errors", () => {
  const ds = buildDataset([good, { ...good, id: "a2", question: "" }, { ...good, id: "a3", answer: "" }, { ...good, id: "a4", question: "Other?", source: "" }, null]);
  assert.equal(ds.records.length, 1);
  assert.equal(ds.issues.filter((i) => i.severity === "error").length, 4);
});

test("optional fields get defaults and warnings", () => {
  const ds = buildDataset([{ ...good, category: "Weird", urgency: "nope", keywords: "a|b" }]);
  const r = ds.records[0];
  assert.equal(r.category, "General healthcare");
  assert.equal(r.urgency, "routine");
  assert.deepEqual(r.keywords, ["a", "b"]);
  assert.deepEqual(r.symptoms, []);
  assert.equal(r.reviewStatus, "sample-unreviewed");
  assert.equal(r.lastReviewed, null);
  assert.ok(ds.issues.every((i) => i.severity === "warning"));
});

test("duplicate questions and ids are dropped", () => {
  const ds = buildDataset([good, { ...good, id: "a2", question: "what is x" }, { ...good, question: "Different?" }]);
  assert.equal(ds.records.length, 1);
  assert.equal(ds.issues.length, 2);
});

test("csv parsing handles quotes, commas and newlines", () => {
  const rows = parseCsv('id,question,answer,source,category\r\na1,"Hi, there?","Line1\nLine ""2""",WHO,General healthcare\r\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].question, "Hi, there?");
  assert.equal(rows[0].answer, 'Line1\nLine "2"');
  assert.equal(parseDatasetText("id,question,answer,source,category\na,Q?,A,S,First aid\n", "csv").records[0].category, "First aid");
});

test("invalid JSON shapes throw; loader never throws", async () => {
  assert.throws(() => parseDatasetText('{"nope":1}', "json"));
  assert.throws(() => parseDatasetText("not json", "json"));
  const dir = await mkdtemp(path.join(tmpdir(), "mb-"));
  const bad = path.join(dir, "bad.json");
  await writeFile(bad, "{{{");
  await assert.rejects(loadDatasetFile(bad));
  process.env.DATASET_PATH = path.join(dir, "missing.json");
  delete process.env.TURSO_DATABASE_URL;
  resetDatasetCache();
  const ds = await getDataset();
  assert.equal(ds.records.length, 0);
  assert.equal(ds.issues[0].severity, "error");
  delete process.env.DATASET_PATH;
  resetDatasetCache();
});

test("array-form dataset works and categories summarize", () => {
  const ds = parseDatasetText(JSON.stringify([good]), "json");
  assert.equal(summarizeCategories(ds.records)[0].count, 1);
});

test("the bundled CSV is the default dataset and all 2000 records load", async () => {
  assert.ok(defaultDatasetPath().endsWith(path.join("data", "medipot_healthcare_dataset_2000.csv")));
  const ds = await loadDatasetFile(defaultDatasetPath());
  assert.equal(ds.records.length, 2000);
  assert.equal(ds.issues.length, 0);
  assert.ok(ds.records.every((record) => record.reviewStatus === "sample-unreviewed"));
});
