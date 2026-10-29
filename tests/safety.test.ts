import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSafety } from "../lib/safety.ts";
import { answerQuestion } from "../lib/chat.ts";
import { sample, sampleIndex, buildIndex } from "./helpers.ts";

const emergencies = [
  "I have severe chest pain",
  "my dad is having a heart attack",
  "I can't breathe properly",
  "he has difficulty breathing",
  "her face is drooping and speech is slurred",
  "I think I'm having a stroke",
  "there is heavy bleeding and it won't stop",
  "someone collapsed and is unresponsive",
  "my child is having a seizure",
  "my throat is swelling after eating peanuts",
  "he drank poison",
  "my baby is choking",
  "this is the worst headache of my life",
  "I'm vomiting blood",
];

test("emergency phrases trigger blocking guidance with 112", () => {
  for (const m of emergencies) {
    const r = checkSafety(m);
    assert.equal(r.blocking, true, m);
    assert.equal(r.response?.urgency, "emergency", m);
    assert.match(r.response!.answer, /112/, m);
    assert.equal(r.response?.matchType, "safety");
    assert.match(r.response!.answer, /keyword rules/i, m);
  }
});

test("self-harm gets supportive guidance with 112 and a helpline", () => {
  const r = checkSafety("I want to end my life");
  assert.equal(r.kind, "self-harm");
  assert.match(r.response!.answer, /112/);
  assert.match(r.response!.answer, /14416/);
});

test("safety runs before dataset matching, even with an empty dataset", () => {
  const empty = { ...sample, records: [] };
  const res = answerQuestion("severe chest pain and sweating", empty, buildIndex([]), 0.3);
  assert.equal(res.matchType, "safety");
  assert.match(res.answer, /112/);
});

test("dosage and prescribing requests are declined without numbers", () => {
  for (const m of ["how many mg of paracetamol can I take", "what dose of ibuprofen for my child", "which medicine should I take for fever", "can you prescribe antibiotics"]) {
    const r = checkSafety(m);
    assert.equal(r.kind, "medication", m);
    assert.doesNotMatch(r.response!.answer, /\d+\s?(mg|ml)/i);
    assert.match(r.response!.answer, /pharmacist/i);
  }
});

test("ordinary questions do not trigger safety", () => {
  for (const m of [
    "What are common causes of headaches?", "How can I maintain healthy hydration?", "What are some healthy sleep habits?",
    "How can I prevent dehydration?", "When should I seek medical attention?", "How much salt and sugar is healthy?",
    "Can I take over-the-counter painkillers regularly?", "Should I stop taking antibiotics when I feel better?",
    "What precautions should I take with medicines?",
  ]) {
    assert.equal(checkSafety(m).triggered, false, m);
  }
});

test("every dataset question avoids unintended blocking, except emergency topics", () => {
  const allowed = new Set(["mb-038", "mb-039", "mb-040", "mb-030", "mb-028"]);
  for (const r of sample.records) {
    const s = checkSafety(r.question);
    if (s.blocking) assert.ok(allowed.has(r.id) || r.urgency === "emergency", `${r.id}: ${r.question}`);
  }
});
