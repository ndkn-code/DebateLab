import assert from "node:assert/strict";
import { streamText } from "./stream";
import {
  getCoachChatCandidates,
  getAiTaskPolicy,
  getGeminiCoachModel,
  getGroqCoachFallbackModel,
  getIeltsCoachCandidates,
} from "./policies";
import { recordGeminiKeySuccess } from "@/lib/gemini/key-pool";

const originalFetch = globalThis.fetch;
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalGroqKey = process.env.GROQ_API_KEY;
const originalCoachModel = process.env.GEMINI_COACH_MODEL;
const originalGroqCoachModel = process.env.GROQ_COACH_FALLBACK_MODEL;

async function collect(
  onProviderSelected: Parameters<typeof streamText>[0]["onProviderSelected"],
) {
  let output = "";
  for await (const chunk of streamText({
    task: "coach_chat",
    messages: [{ role: "user", content: "Help me weigh this argument." }],
    context: {
      task: "coach_chat",
      sourceRoute: "stream-test",
      outputType: "coach_chat",
    },
    policy: { candidates: getCoachChatCandidates(true) },
    onProviderSelected,
  })) {
    output += chunk;
  }
  return output;
}

async function run() {
  delete process.env.GEMINI_COACH_MODEL;
  delete process.env.GROQ_COACH_FALLBACK_MODEL;
  assert.equal(getGeminiCoachModel(), "gemini-3.5-flash-lite");
  assert.equal(getGroqCoachFallbackModel(), "openai/gpt-oss-20b");
  assert.deepEqual(
    getCoachChatCandidates(true).map(({ provider }) => provider),
    ["gemini", "groq"],
  );
  assert.deepEqual(
    getCoachChatCandidates(false).map(({ provider }) => provider),
    ["groq"],
  );
  assert.equal(getCoachChatCandidates(false)[0]?.model, "openai/gpt-oss-20b");
  assert.equal(
    getIeltsCoachCandidates(true)[0]?.model,
    "gemini-3.5-flash-lite",
  );
  assert.equal(
    getIeltsCoachCandidates(false)[0]?.model,
    "qwen/qwen3.8-27b",
  );
  assert.equal(
    getIeltsCoachCandidates(false)[1]?.model,
    "openai/gpt-oss-20b",
  );
  assert.equal(getAiTaskPolicy("ielts_coach_chat").attemptTimeoutMs, 6_000);
  assert.equal(getAiTaskPolicy("ielts_coach_chat").schemaRepairAttempts, 0);

  process.env.GEMINI_API_KEY = "gemini-test-key";
  process.env.GROQ_API_KEY = "groq-test-key";
  let requestedUrl = "";
  let requestedBody: Record<string, unknown> | null = null;
  globalThis.fetch = (async (input, init) => {
    requestedUrl = String(input);
    requestedBody = JSON.parse(String(init?.body));
    return new Response(
      'data: {"candidates":[{"content":{"parts":[{"text":"Gemini reply"}]},"finishReason":"STOP"}],"usageMetadata":{"totalTokenCount":8}}\n\n',
      { status: 200, headers: { "Content-Type": "text/event-stream" } },
    );
  }) as typeof fetch;
  let selected: { provider: string; model: string } | null = null;
  assert.equal(
    await collect((selection) => {
      selected = selection;
    }),
    "Gemini reply",
  );
  assert.match(requestedUrl, /gemini-3\.5-flash-lite:streamGenerateContent/);
  assert.equal(
    (selected as { provider: string; model: string } | null)?.provider,
    "gemini",
  );
  assert.equal(
    (selected as { provider: string; model: string } | null)?.model,
    "gemini-3.5-flash-lite",
  );
  assert.ok(
    Array.isArray((requestedBody as Record<string, unknown> | null)?.contents),
  );

  recordGeminiKeySuccess(0);
  let calls = 0;
  globalThis.fetch = (async (input) => {
    calls += 1;
    if (String(input).includes("generativelanguage")) {
      return new Response(
        JSON.stringify({ error: { message: "temporarily unavailable" } }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(
      'data: {"choices":[{"delta":{"content":"Groq fallback"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
      { status: 200, headers: { "Content-Type": "text/event-stream" } },
    );
  }) as typeof fetch;
  selected = null;
  assert.equal(
    await collect((selection) => {
      selected = selection;
    }),
    "Groq fallback",
  );
  assert.equal(calls, 2);
  assert.equal(
    (selected as { provider: string; model: string } | null)?.provider,
    "groq",
  );
}

void run().finally(() => {
  globalThis.fetch = originalFetch;
  if (originalGeminiKey == null) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalGeminiKey;
  if (originalGroqKey == null) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalGroqKey;
  if (originalCoachModel == null) delete process.env.GEMINI_COACH_MODEL;
  else process.env.GEMINI_COACH_MODEL = originalCoachModel;
  if (originalGroqCoachModel == null)
    delete process.env.GROQ_COACH_FALLBACK_MODEL;
  else process.env.GROQ_COACH_FALLBACK_MODEL = originalGroqCoachModel;
  recordGeminiKeySuccess(0);
});
