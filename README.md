# MediBot – dataset-powered healthcare information chatbot

MediBot answers general healthcare questions (symptoms, nutrition, prevention, first aid, sleep, and more) by matching them against a structured dataset. It does **not** depend on an external AI API. A separate safety module checks every message for emergency wording first.

> MediBot provides general healthcare information for educational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. If you think you are experiencing a medical emergency, contact emergency services immediately (112 in India).

## Features

- Chat UI with sidebar, recent chats, chat search, topic browser, suggested prompts, typing indicator, copy, clear chat, Helpful / Not helpful, source references, and empty / error / no-match states
- TF-IDF + cosine similarity matching in TypeScript, with a configurable confidence threshold, synonym handling, and a rule that one shared keyword is never enough for a multi-word question
- Safety module that runs before matching: emergency symptoms (chest pain, breathing trouble, stroke signs, severe bleeding, seizure, anaphylaxis, poisoning and more), self-harm support, and refusal of dose / prescribing requests
- Light and dark themes, responsive down to phones, keyboard-accessible
- Optional OpenAI responses for questions that do not match the dataset; the dataset remains the primary answer source
- Optional Turso/libSQL for the dataset and anonymous feedback. Without it, everything runs from the local CSV file
- Chats stay in memory; saving them to the device (localStorage) is opt-in and can be deleted at any time. Conversations are never stored on the server
- When OpenAI is configured, only questions that do not match the local dataset are sent to OpenAI for a generated answer; chat history is not sent

## Technology stack

TypeScript, JavaScript (config and scripts), Next.js 15 (App Router), React 19, Tailwind CSS 3, SQL (libSQL/SQLite dialect), Turso (optional), JSON/CSV dataset, Git/GitHub, Vercel.

## Project structure

```
app/api/chat/route.ts       POST /api/chat (validate -> safety -> match -> typed JSON)
app/api/feedback/route.ts   anonymous feedback (no-op without Turso)
components/                 Sidebar, ChatApp, ChatWindow, ChatMessage, ChatInput, ...
lib/safety.ts               emergency / self-harm / medication rules (independent of the dataset)
lib/matching.ts             TF-IDF engine (pure functions, no UI imports)
lib/dataset.ts              load, validate, de-duplicate JSON/CSV (and Turso if configured)
lib/validation.ts           request and record validation, rate limiting
lib/chat.ts                 the answer pipeline used by the API route
lib/database.ts             optional Turso access (server only, parameterized queries)
data/healthcare_dataset.json
database/schema.sql
scripts/seed-db.mjs
tests/                      node:test suites
```

## Dataset

**Source and license: please read.** The app defaults to `data/medipot_healthcare_dataset_2000.csv`, which contains 2,000 entries, including paraphrased questions. `data/healthcare_dataset.json` is the original sample dataset of 40 entries. The content is intended as short plain-language summaries of widely published general guidance. Each entry's `source` and `sourceUrl` name the organisation and topic area (for example NHS, WHO, MedlinePlus, CDC) to verify against; **no entry has been checked against its source page, and no entry has been clinically reviewed**. Dataset statuses other than `"reviewed"` are treated as `"sample-unreviewed"`, and the UI says so under each answer. Before real use:

1. Check every link and claim against the named source.
2. Have a qualified clinician review the answers.
3. Only then set `reviewStatus` to `"reviewed"` and fill in `lastReviewed` (YYYY-MM-DD).

The helpline numbers in `lib/safety.ts` and the dataset (112, Tele-MANAS 14416) should also be verified periodically. The sample content is released under the same MIT license as the code.

### Format

| Field | Required | Notes |
|---|---|---|
| `id` | no | unique; generated if missing |
| `question` | yes | canonical question |
| `answer` | yes | plain text; `\n` for line breaks |
| `source` | yes | rows without a source are rejected |
| `category` | yes | one of the 10 categories in `types/healthcare.ts` (unknown -> General healthcare + warning) |
| `symptoms`, `keywords` | no | arrays (in CSV: separated by `\|`) |
| `urgency` | no | `routine`, `monitor`, `see-doctor`, `emergency` (default `routine`) |
| `sourceUrl` | no | http(s) link |
| `lastReviewed` | no | `YYYY-MM-DD` or null |
| `reviewStatus` | no | `sample-unreviewed` (default) or `reviewed` |

The JSON file is `{ "meta": {...}, "records": [...] }` or a bare array. CSV files need a header row with the same field names. Invalid rows are skipped, duplicates (same normalised question or id) are dropped, and every problem is collected as an issue. The file lives outside `public/` and is only read on the server.

### Adding or updating entries

1. Update `data/medipot_healthcare_dataset_2000.csv` (or point `DATASET_PATH` at another `.json`/`.csv`).
2. Write several `keywords` and `symptoms` people actually use; they carry more weight than the answer text.
3. Run `npm test`, then try the question in the app.
4. If you use Turso, run `npm run db:seed` to re-import.

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | development, production build, serve build |
| `npm run lint` / `typecheck` | ESLint, `tsc --noEmit` |
| `npm test` | unit tests (Node 22+; uses the built-in test runner) |
| `npm run db:seed` | apply `schema.sql` and import the dataset into Turso |

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `MATCH_CONFIDENCE_THRESHOLD` | `0.3` | minimum confidence for a dataset answer; raise it for stricter matching |
| `DATASET_PATH` | `data/medipot_healthcare_dataset_2000.csv` | alternative `.json` or `.csv` dataset file |
| `OPENAI_API_KEY` | unset | optional server-only API key; enables AI answers when no dataset answer matches |
| `OPENAI_MODEL` | `gpt-4.1-mini` | optional OpenAI model for fallback answers |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | unset | enable Turso. Server-only, never exposed to the browser |

### Optional: Turso

```bash
turso db create medibot
turso db show medibot --url          # TURSO_DATABASE_URL
turso db tokens create medibot       # TURSO_AUTH_TOKEN
npm run db:seed
```

When configured, the dataset loads from the database (falling back to the file if the database is empty or unreachable) and feedback votes are stored. Stored feedback contains only a message id, a dataset record id and the vote, never message text.

## Testing

`npm test` covers exact and similar question matching, low-confidence and empty input, missing/duplicate dataset fields, CSV parsing, dataset-loading failures, emergency/self-harm/medication safety cases, safety running with an empty dataset, and invalid API requests plus rate limiting. The Turso code paths and the React UI are not covered by automated tests.

## GitHub and Vercel

```bash
git clone https://github.com/shubham5177/Medibot.git
cd Medibot
npm install
npm run build
```

1. Push the project to `https://github.com/shubham5177/Medibot`.
2. In Vercel choose **Add New -> Project**, import `shubham5177/Medibot`, and keep the project root at the repository root (the folder containing `package.json`).
3. Use the Next.js framework preset and Node.js 22.
4. Add `MATCH_CONFIDENCE_THRESHOLD=0.3` under **Settings -> Environment Variables**. Add `OPENAI_API_KEY` only if you want AI answers for questions the dataset cannot answer; add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` only if using Turso. Keep all secrets in Vercel's server-side environment variables, never in source control or `NEXT_PUBLIC_` variables.
5. Deploy. The Next.js config includes the server-only `data/` files in output tracing, so the CSV dataset is available at runtime without a database.

If you add this to an existing portfolio, copy the folders in rather than replacing files, and keep your existing domain and Git remote.

## Limitations and safety notes

- The sample dataset is small and **unreviewed**; answers are only as good as the entries.
- Matching is lexical. It handles synonyms and word forms but not meaning, so unusual phrasing may fall back to "please rephrase".
- The emergency detector is keyword-based. It can miss emergencies and can trigger on non-emergencies (it does not understand negation, for example "no chest pain" still triggers). It must never be treated as a way to rule an emergency out; the app says so in its replies.
- MediBot does not diagnose, prescribe, or give doses. It does not ask for or store personal health information; the API route never logs message text.
- The in-memory rate limiter is per server instance; use an edge or database-backed limiter for serious traffic.
- Content is English only. India-specific emergency numbers are assumed (112).
