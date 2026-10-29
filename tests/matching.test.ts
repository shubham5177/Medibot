import { test } from "node:test";
import assert from "node:assert/strict";
import { sample, sampleIndex, buildIndex } from "./helpers.ts";
import { searchIndex, tokenize } from "../lib/matching.ts";
import { answerQuestion, parseThreshold } from "../lib/chat.ts";

const top = (q: string, threshold?: number) => searchIndex(sampleIndex, q, { threshold });

test("dataset loads without errors", () => {
  assert.ok(sample.records.length >= 30);
  assert.equal(sample.issues.filter((i) => i.severity === "error").length, 0);
});

test("exact question matching", () => {
  for (const r of sample.records) {
    const out = top(r.question);
    assert.equal(out.status, "match", r.question);
    assert.equal(out.best?.record.id, r.id, r.question);
    assert.equal(out.best?.confidence, 1);
  }
});

test("exact match ignores case and punctuation", () => {
  assert.equal(top("WHAT ARE COMMON CAUSES OF HEADACHES").best?.record.question, "What are common causes of headaches?");
});

test("similar question matching", () => {
  const cases: [string, string][] = [
    ["why do I get headaches", "mb-005"],
    ["how do I stay hydrated", "mb-013"],
    ["tips for better sleep", "mb-030"],
    ["how can I avoid dehydration in summer", "mb-014"],
    ["what is a healthy diet", "mb-015"],
    ["how do I treat a burn on my hand", "mb-025"],
    ["I keep getting a cough that will not go away", "mb-009"],
    ["why am I always tired", "mb-010"],
    ["how much exercise should I do each week", "mb-031"],
    ["what are the symptoms of high blood pressure", "mb-036"],
  ];
  for (const [q, id] of cases) {
    const out = top(q);
    assert.equal(out.best?.record.id, id, `${q} -> ${out.best?.record.id} (${out.best?.confidence.toFixed(2)})`);
  }
});

test("low-confidence and unrelated questions get no match", () => {
  for (const q of ["what is the capital of France", "how do I fix my car engine", "xyzzy plugh", "tell me a joke about cats", "best pizza near me"]) {
    assert.equal(top(q).status, "no-match", q);
  }
});

test("a single shared keyword is not enough for a multi-word question", () => {
  const out = top("quantum physics of sleep on mars");
  assert.equal(out.status, "no-match");
});

test("empty and stop-word-only input", () => {
  assert.equal(top("").status, "empty-query");
  assert.equal(top("   ?!  ").status, "empty-query");
  assert.equal(top("what is the").status, "empty-query");
});

test("empty dataset is handled", () => {
  assert.equal(searchIndex(buildIndex([]), "headache").status, "empty-dataset");
});

test("threshold is configurable", () => {
  const q = "stomach hurting";
  const loose = top(q, 0.05);
  const strict = top(q, 0.99);
  assert.equal(loose.status, "match");
  assert.equal(strict.status, "no-match");
  assert.equal(parseThreshold("0.5"), 0.5);
  assert.equal(parseThreshold("abc"), 0.3);
  assert.equal(parseThreshold("2"), 0.3);
  assert.equal(parseThreshold(undefined), 0.3);
});

test("stemming lines up plural and verb forms", () => {
  assert.deepEqual(tokenize("headaches"), tokenize("headache"));
  assert.deepEqual(tokenize("sleeping"), tokenize("sleep"));
});

test("answerQuestion returns typed dataset response with source", () => {
  const res = answerQuestion("What are some healthy sleep habits?", sample, sampleIndex, 0.3);
  assert.equal(res.matchType, "dataset");
  assert.ok(res.source?.name);
  assert.equal(res.reviewStatus, "sample-unreviewed");
  assert.ok(res.confidence >= 0.3);
});

test("answerQuestion falls back safely", () => {
  const res = answerQuestion("what is the capital of France", sample, sampleIndex, 0.3);
  assert.equal(res.matchType, "fallback");
  assert.equal(res.source, null);
  assert.match(res.answer, /rephrase/i);
});

test("diagnosis requests get a notice but still use the dataset", () => {
  const res = answerQuestion("do I have diabetes? what are the symptoms of diabetes", sample, sampleIndex, 0.3);
  assert.equal(res.matchType, "dataset");
  assert.match(res.answer, /can't diagnose/i);
});
