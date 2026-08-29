import assert from "node:assert/strict";
import { z } from "zod";
import { generateStructured, generateText, getAiTaskPolicy } from "./index";
import { extractJsonObject } from "./json";
import { recordGeminiKeySuccess } from "@/lib/gemini/key-pool";

const originalFetch = globalThis.fetch;
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalGroqKey = process.env.GROQ_API_KEY;

async function run() {
  assert.deepEqual(extractJsonObject("```json\n{\"ok\":true}\n```"), { ok: true });
  assert.throws(() => extractJsonObject("not json"));
  assert.equal(getAiTaskPolicy("practice_judging").criticality, "critical");
  assert.equal(getAiTaskPolicy("ielts_speaking_score").candidates[1]?.provider, "groq");
  assert.equal(getAiTaskPolicy("ielts_writing_score").candidates[0]?.provider, "gemini");

  process.env.GROQ_API_KEY = "test-key";
  let groqRequest: Record<string, unknown> | null = null;
  globalThis.fetch = (async (_input, init) => {
    groqRequest = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "plain text" } }], usage: {} }), { status: 200 });
  }) as typeof fetch;
  const text = await generateText({
    task: "coach_title",
    messages: [{ role: "user", content: "title" }],
    context: { task: "coach_title", sourceRoute: "core-test", outputType: "test" },
  });
  assert.equal(text.output, "plain text");
  assert.equal("response_format" in (groqRequest ?? {}), false);
  assert.ok(text.traceId);

  process.env.GEMINI_API_KEY = "test-key";
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    const body = calls === 1 ? "not-json" : '{"value":"repaired"}';
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: body }] } }], usageMetadata: {} }), { status: 200 });
  }) as typeof fetch;
  const structured = await generateStructured({
    task: "onboarding_feedback",
    prompt: "return json",
    schema: z.object({ value: z.string() }),
    context: { task: "onboarding_feedback", sourceRoute: "core-test", outputType: "test" },
  });
  assert.equal(structured.output.value, "repaired");
  assert.equal(calls, 2);
  assert.equal(structured.fallbackUsed, false);
  assert.ok(structured.attempts.some((attempt) => attempt.status === "success"));

  calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: { message: "temporary unavailable" } }), { status: 503 });
  }) as typeof fetch;
  await assert.rejects(
    generateStructured({
      task: "onboarding_feedback",
      prompt: "return json",
      schema: z.object({ value: z.string() }),
      context: { task: "onboarding_feedback", sourceRoute: "core-test", outputType: "test" },
    }),
  );
  assert.equal(calls, 1, "provider failure must not consume a schema-repair call");
  recordGeminiKeySuccess(0);

  calls = 0;
  globalThis.fetch = (async (input) => {
    calls += 1;
    const url = String(input);
    const text = url.includes("generativelanguage") ? "not-json" : '{"value":"fallback"}';
    if (url.includes("generativelanguage")) {
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: {} }), { status: 200 });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: text } }], usage: {} }), { status: 200 });
  }) as typeof fetch;
  const fallback = await generateStructured({
    task: "onboarding_feedback",
    prompt: "return json",
    schema: z.object({ value: z.string() }),
    context: { task: "onboarding_feedback", sourceRoute: "core-test", outputType: "test" },
    policy: {
      candidates: [
        { provider: "gemini", model: "test-gemini" },
        { provider: "groq", model: "test-groq" },
      ],
    },
  });
  assert.equal(calls, 3, "primary JSON plus repair then fallback provider");
  assert.equal(fallback.output.value, "fallback");
  assert.equal(fallback.fallbackUsed, true);
}

void run().finally(() => {
  globalThis.fetch = originalFetch;
  if (originalGeminiKey == null) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalGeminiKey;
  if (originalGroqKey == null) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalGroqKey;
});
