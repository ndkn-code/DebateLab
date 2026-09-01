import assert from "node:assert/strict";
import { z } from "zod";
import { generateStructured, generateText, getAiTaskPolicy } from "./index";
import { extractJsonObject } from "./json";
import { recordGeminiKeySuccess } from "@/lib/gemini/key-pool";

const originalFetch = globalThis.fetch;
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalGroqKey = process.env.GROQ_API_KEY;
const originalIeltsCoachModel = process.env.GROQ_IELTS_COACH_MODEL;
const originalIeltsCoachFallbackModel =
  process.env.GROQ_IELTS_COACH_FALLBACK_MODEL;

async function run() {
  process.env.GROQ_IELTS_COACH_MODEL = "test-ielts-coach-primary";
  process.env.GROQ_IELTS_COACH_FALLBACK_MODEL = "test-ielts-coach-fallback";
  assert.deepEqual(extractJsonObject('```json\n{"ok":true}\n```'), {
    ok: true,
  });
  assert.throws(() => extractJsonObject("not json"));
  assert.equal(getAiTaskPolicy("practice_judging").criticality, "critical");
  assert.equal(getAiTaskPolicy("ielts_speaking_score").candidates.length, 2);
  assert.equal(
    getAiTaskPolicy("ielts_speaking_score").candidates[0]?.provider,
    "groq",
  );
  assert.equal(
    getAiTaskPolicy("ielts_writing_score").candidates[0]?.provider,
    "groq",
  );
  assert.equal(
    getAiTaskPolicy("ielts_speaking_adjudication").candidates[0]?.provider,
    "groq",
  );
  assert.equal(
    getAiTaskPolicy("ielts_writing_score").candidates[1]?.model,
    "openai/gpt-oss-20b",
  );
  assert.equal(
    getAiTaskPolicy("ielts_writing_score").candidates.every(
      (candidate) => candidate.provider === "groq",
    ),
    true,
  );
  const ieltsCoachPolicy = getAiTaskPolicy("ielts_coach_chat");
  assert.equal(ieltsCoachPolicy.candidates.length, 2);
  assert.equal(
    ieltsCoachPolicy.candidates.every((candidate) => candidate.provider === "groq"),
    true,
  );

  process.env.GROQ_API_KEY = "test-key";
  let groqRequest: Record<string, unknown> | null = null;
  globalThis.fetch = (async (_input, init) => {
    groqRequest = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        choices: [
          { finish_reason: "stop", message: { content: "plain text" } },
        ],
        usage: {},
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const text = await generateText({
    task: "coach_title",
    messages: [{ role: "user", content: "title" }],
    context: {
      task: "coach_title",
      sourceRoute: "core-test",
      outputType: "test",
    },
  });
  assert.equal(text.output, "plain text");
  assert.equal("response_format" in (groqRequest ?? {}), false);
  assert.ok(text.traceId);

  process.env.GEMINI_API_KEY = "test-key";
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    const body = calls === 1 ? "not-json" : '{"value":"repaired"}';
    return new Response(
      JSON.stringify({
        choices: [{ finish_reason: "stop", message: { content: body } }],
        usage: {},
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const structured = await generateStructured({
    task: "onboarding_feedback",
    prompt: "return json",
    schema: z.object({ value: z.string() }),
    context: {
      task: "onboarding_feedback",
      sourceRoute: "core-test",
      outputType: "test",
    },
  });
  assert.equal(structured.output.value, "repaired");
  assert.equal(calls, 2);
  assert.equal(structured.fallbackUsed, false);
  assert.ok(
    structured.attempts.some((attempt) => attempt.status === "success"),
  );

  calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(
      JSON.stringify({ error: { message: "temporary unavailable" } }),
      { status: 503 },
    );
  }) as typeof fetch;
  await assert.rejects(
    generateStructured({
      task: "onboarding_feedback",
      prompt: "return json",
      schema: z.object({ value: z.string() }),
      context: {
        task: "onboarding_feedback",
        sourceRoute: "core-test",
        outputType: "test",
      },
    }),
  );
  assert.equal(
    calls,
    1,
    "provider failure must not consume a schema-repair call",
  );
  recordGeminiKeySuccess(0);

  calls = 0;
  globalThis.fetch = (async (input) => {
    calls += 1;
    const url = String(input);
    const text = url.includes("generativelanguage")
      ? "not-json"
      : '{"value":"fallback"}';
    if (url.includes("generativelanguage")) {
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text }] } }],
          usageMetadata: {},
        }),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify({ choices: [{ message: { content: text } }], usage: {} }),
      { status: 200 },
    );
  }) as typeof fetch;
  const fallback = await generateStructured({
    task: "onboarding_feedback",
    prompt: "return json",
    schema: z.object({ value: z.string() }),
    context: {
      task: "onboarding_feedback",
      sourceRoute: "core-test",
      outputType: "test",
    },
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

  calls = 0;
  globalThis.fetch = (async (_input, init) => {
    calls += 1;
    const request = JSON.parse(String(init?.body)) as { model?: string };
    if (request.model === ieltsCoachPolicy.candidates[0]?.model) {
      return new Response(
        JSON.stringify({ error: { message: "primary unavailable" } }),
        { status: 503 },
      );
    }
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: '{"value":"fast-fallback"}' } }],
        usage: {},
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const ieltsCoachFallback = await generateStructured({
    task: "ielts_coach_chat",
    prompt: "return json",
    schema: z.object({ value: z.string() }),
    context: {
      task: "ielts_coach_chat",
      sourceRoute: "core-test",
      outputType: "test",
    },
  });
  assert.equal(ieltsCoachFallback.output.value, "fast-fallback");
  assert.equal(ieltsCoachFallback.fallbackUsed, true);
  assert.equal(calls, 2);

  calls = 0;
  const ieltsWritingPolicy = getAiTaskPolicy("ielts_writing_score");
  globalThis.fetch = (async (_input, init) => {
    calls += 1;
    const request = JSON.parse(String(init?.body)) as { model?: string };
    if (request.model === ieltsWritingPolicy.candidates[0]?.model) {
      return new Response(
        JSON.stringify({ error: { message: "model rate limit reached" } }),
        { status: 429, headers: { "retry-after": "1" } },
      );
    }
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: '{"value":"scoring-fallback"}' } }],
        usage: {},
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const ieltsScoringFallback = await generateStructured({
    task: "ielts_writing_score",
    prompt: "return json",
    schema: z.object({ value: z.string() }),
    context: {
      task: "ielts_writing_score",
      sourceRoute: "core-test",
      outputType: "test",
    },
  });
  assert.equal(ieltsScoringFallback.output.value, "scoring-fallback");
  assert.equal(ieltsScoringFallback.fallbackUsed, true);
  assert.equal(calls, 2, "a primary 429 must use the fast Groq fallback");

  calls = 0;
  globalThis.fetch = (async (_input, init) => {
    calls += 1;
    const request = JSON.parse(String(init?.body)) as { model?: string };
    if (request.model === ieltsCoachPolicy.candidates[0]?.model) {
      if (calls === 1) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"value":42}' } }],
            usage: {},
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          error: {
            message:
              "Failed to validate JSON. Please adjust your prompt. See 'failed_generation' for more details.",
          },
        }),
        { status: 400 },
      );
    }
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: '{"value":"schema-fallback"}' } }],
        usage: {},
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const ieltsSchemaFallback = await generateStructured({
    task: "ielts_coach_chat",
    prompt: "return json",
    schema: z.object({ value: z.string() }),
    context: {
      task: "ielts_coach_chat",
      sourceRoute: "core-test",
      outputType: "test",
    },
  });
  assert.equal(ieltsSchemaFallback.output.value, "schema-fallback");
  assert.equal(ieltsSchemaFallback.fallbackUsed, true);
  assert.equal(
    calls,
    3,
    "a JSON-mode validation rejection during repair must advance to fallback",
  );

  let strictResponseFormat: unknown;
  globalThis.fetch = (async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as {
      response_format?: unknown;
    };
    strictResponseFormat = request.response_format;
    return new Response(
      JSON.stringify({
        choices: [
          { message: { content: '{"value":"strict","note":null}' } },
        ],
        usage: {},
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const strictStructured = await generateStructured({
    task: "ielts_coach_chat",
    prompt: "return json",
    schema: z
      .object({ value: z.string(), note: z.string().optional() })
      .strict(),
    context: {
      task: "ielts_coach_chat",
      sourceRoute: "core-test",
      outputType: "test",
    },
    policy: {
      candidates: [{ provider: "groq", model: "openai/gpt-oss-20b" }],
    },
  });
  assert.equal(strictStructured.output.value, "strict");
  assert.equal(strictStructured.output.note, undefined);
  assert.deepEqual(strictResponseFormat, {
    type: "json_schema",
    json_schema: {
      name: "ielts_coach_chat_response",
      strict: true,
      schema: {
        type: "object",
        properties: {
          value: { type: "string" },
          note: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
        required: ["value", "note"],
        additionalProperties: false,
      },
    },
  });
}

void run().finally(() => {
  globalThis.fetch = originalFetch;
  if (originalGeminiKey == null) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalGeminiKey;
  if (originalGroqKey == null) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalGroqKey;
  if (originalIeltsCoachModel == null)
    delete process.env.GROQ_IELTS_COACH_MODEL;
  else process.env.GROQ_IELTS_COACH_MODEL = originalIeltsCoachModel;
  if (originalIeltsCoachFallbackModel == null)
    delete process.env.GROQ_IELTS_COACH_FALLBACK_MODEL;
  else
    process.env.GROQ_IELTS_COACH_FALLBACK_MODEL =
      originalIeltsCoachFallbackModel;
});
