const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const REQUEST_TIMEOUT_MS = 20_000;

const INSTRUCTIONS = [
  "You provide brief, general health information for education only.",
  "Do not diagnose, prescribe, recommend medication dosages, or claim certainty.",
  "Encourage the user to contact a qualified healthcare professional for personal advice.",
  "If symptoms may be urgent, advise contacting local emergency services.",
  "Do not claim to have checked sources or cite sources you did not consult.",
  "Use plain language and keep the answer concise.",
].join(" ");

export class OpenAIRequestError extends Error {
  constructor() {
    super("OpenAI request failed.");
    this.name = "OpenAIRequestError";
  }
}

/** Returns null when OpenAI is not configured; the API key is only read server-side. */
export async function generateOpenAIAnswer(message: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  let response: Response;
  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        instructions: INSTRUCTIONS,
        input: message,
        max_output_tokens: 500,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new OpenAIRequestError();
  }

  if (!response.ok) throw new OpenAIRequestError();

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new OpenAIRequestError();
  }

  if (typeof data !== "object" || data === null || !("output_text" in data)) {
    throw new OpenAIRequestError();
  }
  const answer = (data as { output_text?: unknown }).output_text;
  if (typeof answer !== "string" || !answer.trim()) throw new OpenAIRequestError();

  return answer.trim();
}
