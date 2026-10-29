import { test } from "node:test";
import assert from "node:assert/strict";
import { generateOpenAIAnswer, OpenAIRequestError } from "../lib/openai.ts";

test("OpenAI generation is disabled when no key is configured", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    assert.equal(await generateOpenAIAnswer("What might cause a headache?"), null);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("OpenAI generation sends the question server-side and returns response text", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_MODEL;
  const originalFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "test-model";
  let requestBody = "";
  let authorization = "";
  globalThis.fetch = async (_input, init) => {
    requestBody = String(init?.body);
    authorization = new Headers(init?.headers).get("Authorization") ?? "";
    return new Response(JSON.stringify({ output_text: "Drink water and rest." }), { status: 200 });
  };
  try {
    assert.equal(await generateOpenAIAnswer("How can I care for a mild headache?"), "Drink water and rest.");
    assert.equal(authorization, "Bearer test-key");
    assert.equal(JSON.parse(requestBody).model, "test-model");
    assert.equal(JSON.parse(requestBody).input, "How can I care for a mild headache?");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = previousModel;
  }
});

test("OpenAI failures are reported without exposing provider details", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => new Response("provider details", { status: 401 });
  try {
    await assert.rejects(generateOpenAIAnswer("question"), OpenAIRequestError);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});
