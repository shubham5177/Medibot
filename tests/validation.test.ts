import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_MESSAGE_LENGTH, checkRateLimit, validateChatRequest, validateFeedbackRequest } from "../lib/validation.ts";

test("invalid chat requests are rejected", () => {
  for (const body of [null, undefined, "hi", 42, [], {}, { message: 5 }, { message: "" }, { message: "   \n " }]) {
    const r = validateChatRequest(body);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 400);
  }
});

test("over-long messages get 413", () => {
  const r = validateChatRequest({ message: "a".repeat(MAX_MESSAGE_LENGTH + 1) });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 413);
});

test("valid message is trimmed", () => {
  const r = validateChatRequest({ message: "  hello  " });
  assert.deepEqual(r, { ok: true, message: "hello" });
});

test("feedback validation", () => {
  assert.equal(validateFeedbackRequest({ messageId: "abc-123", helpful: true }).ok, true);
  assert.equal(validateFeedbackRequest({ messageId: "bad id!", helpful: true }).ok, false);
  assert.equal(validateFeedbackRequest({ messageId: "abc", helpful: "yes" }).ok, false);
  assert.equal(validateFeedbackRequest({ messageId: "abc", helpful: false, recordId: "x y" }).ok, false);
});

test("rate limiter blocks after the limit and recovers", () => {
  const k = "ip-test";
  for (let i = 0; i < 3; i++) assert.equal(checkRateLimit(k, 3, 1000, 0), true);
  assert.equal(checkRateLimit(k, 3, 1000, 10), false);
  assert.equal(checkRateLimit(k, 3, 1000, 2000), true);
});
