/**
 * Practice judge reliability shadow test.
 *
 * Run from apps/web so .env.local is picked up:
 *   npm run practice:judge:shadow
 *
 * Optional:
 *   npm run practice:judge:shadow -- --email local-test-user@example.com
 */
import assert from "node:assert/strict";
import * as path from "node:path";
import Module from "node:module";
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AiQualityTelemetry } from "../apps/web/src/lib/ai/quality-model";

type ShadowScenario = "gemini_happy" | "gemini_failure_deepseek_fallback";

type ProfileRow = {
  id: string;
  email?: string | null;
  role?: string | null;
};

type ProviderRequestRow = {
  id: string;
  provider: string;
  status: string;
  error_code: string | null;
  latency_ms: number | null;
  created_at: string;
};

function installServerOnlyShim() {
  const requireForShim = Module.createRequire(import.meta.url);
  const serverOnlyPath = requireForShim.resolve("server-only");
  requireForShim.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
    children: [],
    paths: [],
  } as NodeModule & { paths: string[] };
}

function parseArgs() {
  const args = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    const nextValue = process.argv[index + 1];
    if (inlineValue != null) {
      args.set(key, inlineValue);
    } else if (nextValue && !nextValue.startsWith("--")) {
      args.set(key, nextValue);
      index += 1;
    } else {
      args.set(key, "true");
    }
  }
  return args;
}

function requireEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) throw new Error(`Missing ${name}${fallback ? ` or ${fallback}` : ""}`);
  return value;
}

function wordCount(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

function maskEmail(value: string | null | undefined) {
  if (!value) return null;
  const [name, domain] = value.split("@");
  if (!domain) return value;
  return `${name.slice(0, 2)}***@${domain}`;
}

async function resolveShadowProfile(
  supabase: SupabaseClient,
  requestedEmail?: string
) {
  if (requestedEmail) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,role")
      .eq("email", requestedEmail)
      .single();
    if (error || !data) {
      throw new Error(`Shadow profile not found for ${requestedEmail}`);
    }
    return data as ProfileRow;
  }

  const { data: admins } = await supabase
    .from("profiles")
    .select("id,email,role")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1);

  if (admins?.[0]) return admins[0] as ProfileRow;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,role")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error || !data?.[0]) {
    throw new Error("No profile is available for practice judge shadow test");
  }
  return data[0] as ProfileRow;
}

function buildInput(scenario: ShadowScenario) {
  const transcript =
    "I support banning homework in primary schools because the school day already gives children structured learning time. " +
    "First, homework creates unequal outcomes because families with more money can provide quiet rooms, tutoring, and parent help, while poorer families cannot. " +
    "Second, young children need rest and play to develop attention and motivation, so extra worksheets can make learning worse the next day. " +
    "The opposition may say homework builds discipline, but discipline can be built through reading time, class routines, and optional projects without making every child do graded work at home. " +
    "For weighing, the academic benefit for primary homework is small, while the inequality and stress harms are immediate.";

  return {
    transcript,
    topic: "This house would ban homework in primary schools",
    side: "proposition" as const,
    speechType: "Quick Debate Practice",
    timeLimit: 2,
    actualDuration: 75,
    practiceTrack: "debate" as const,
    practiceLanguage: "en" as const,
    isFullRound: false,
    mode: "quick" as const,
    prepTime: 60,
    speechTime: 120,
    prepNotes: `QA shadow scenario: ${scenario}`,
    topicId: undefined,
    practiceTopicKey: `qa-shadow-${scenario}`,
    topicCategory: "Education",
    topicCategoryKey: "education",
    topicDifficulty: "beginner" as const,
  };
}

async function fetchProviderRequests(
  supabase: SupabaseClient,
  analysisJobId: string
) {
  const { data, error } = await supabase
    .from("ai_provider_requests")
    .select("id,provider,status,error_code,latency_ms,created_at")
    .eq("analysis_job_id", analysisJobId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`provider request audit query failed: ${error.message}`);
  return (data ?? []) as ProviderRequestRow[];
}

async function runScenario(params: {
  supabase: SupabaseClient;
  userId: string;
  scenario: ShadowScenario;
  forceGeminiFailure?: boolean;
}) {
  const {
    createPracticeAnalysisRecords,
    markPracticeAnalysisCompleted,
    markPracticeAnalysisFailed,
    markPracticeAnalysisProcessing,
  } = await import("../apps/web/src/lib/practice-analysis/service");
  const { evaluatePracticeFeedback } = await import(
    "../apps/web/src/lib/practice-analysis/evaluators"
  );
  const { recordAiQualityRun } = await import("../apps/web/src/lib/ai/quality");
  const {
    getPracticeFeedbackModelName,
    getPracticeFeedbackModelProvider,
    getRubricKeyForPracticeTrack,
    PRACTICE_FEEDBACK_PROMPT_BUNDLE_KEY,
    PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION,
    PRACTICE_FEEDBACK_RUBRIC_VERSION,
  } = await import("../apps/web/src/lib/practice-analysis/constants");

  const input = buildInput(params.scenario);
  const debugId = `practice-judge-shadow-${params.scenario}-${Date.now()}`;
  const { attempt, job } = await createPracticeAnalysisRecords(
    params.supabase,
    params.userId,
    input,
    { debugId }
  );

  const claimed = await markPracticeAnalysisProcessing(params.supabase, {
    jobId: job.id,
    attemptId: attempt.id,
    deliveryCount: 1,
  });
  assert.equal(claimed, true, "shadow job should be claimed for processing");

  const originalGeminiApiKey = process.env.GEMINI_API_KEY;
  const originalGeminiApiKeys = process.env.GEMINI_API_KEYS;
  if (params.forceGeminiFailure) {
    process.env.GEMINI_API_KEY = "practice-judge-shadow-invalid-key";
    process.env.GEMINI_API_KEYS = "practice-judge-shadow-invalid-key";
  }

  const startedAt = Date.now();
  let telemetry: AiQualityTelemetry | null = null;

  try {
    const feedback = await evaluatePracticeFeedback(
      {
        ...input,
        providerAudit: {
          sourceRoute: "/qa/practice-judge-shadow",
          practiceAttemptId: attempt.id,
          analysisJobId: job.id,
          metadata: {
            shadowTest: true,
            shadowScenario: params.scenario,
            debugId,
          },
        },
      },
      params.userId,
      (nextTelemetry) => {
        telemetry = nextTelemetry;
      }
    );

    const elapsedMs = Date.now() - startedAt;
    const providerRequests = await fetchProviderRequests(params.supabase, job.id);
    const modelName =
      telemetry?.model ?? getPracticeFeedbackModelName(input.practiceTrack);
    const provider =
      telemetry?.provider ?? getPracticeFeedbackModelProvider(input.practiceTrack);
    const aiQualityRunId = telemetry
      ? await recordAiQualityRun(params.supabase, {
          ...telemetry,
          userId: params.userId,
          outputType: "practice_judging",
          sourceRoute: "/qa/practice-judge-shadow",
          promptBundleKey: PRACTICE_FEEDBACK_PROMPT_BUNDLE_KEY,
          promptBundleVersion: PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION,
          rubricKey: getRubricKeyForPracticeTrack(input.practiceTrack),
          rubricVersion: PRACTICE_FEEDBACK_RUBRIC_VERSION,
          practiceTrack: input.practiceTrack,
          practiceLanguage: input.practiceLanguage,
          difficulty: input.topicDifficulty,
          debateFormat: input.mode,
          side: input.side,
          topicTitle: input.topic,
          winner: feedback.debateVerdict?.winner ?? null,
          score: feedback.totalScore,
          confidence: feedback.debateVerdict?.confidence ?? null,
          outputText: JSON.stringify(feedback),
          inputPreview: input.transcript,
          practiceAttemptId: attempt.id,
          analysisJobId: job.id,
          metadata: {
            ...(telemetry.metadata ?? {}),
            shadowTest: true,
            shadowScenario: params.scenario,
            debugId,
            wordCount: wordCount(input.transcript),
          },
        })
      : null;

    await markPracticeAnalysisCompleted(params.supabase, {
      attemptId: attempt.id,
      jobId: job.id,
      feedback,
      modelName,
      modelProvider: provider,
      legacySessionId: null,
      aiQualityRunId,
      resultMetadata: {
        debugId,
        shadowTest: true,
        shadowScenario: params.scenario,
      },
    });

    return {
      scenario: params.scenario,
      attemptId: attempt.id,
      jobId: job.id,
      debugId,
      elapsedMs,
      provider,
      modelName,
      aiQualityRunId,
      providerRequests,
      totalScore: feedback.totalScore,
    };
  } catch (error) {
    await markPracticeAnalysisFailed(params.supabase, {
      jobId: job.id,
      attemptId: attempt.id,
      errorCode: "SHADOW_TEST_FAILED",
      errorMessage: error instanceof Error ? error.message : String(error),
    }).catch(() => null);
    throw error;
  } finally {
    if (params.forceGeminiFailure) {
      if (originalGeminiApiKey == null) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalGeminiApiKey;
      }
      if (originalGeminiApiKeys == null) {
        delete process.env.GEMINI_API_KEYS;
      } else {
        process.env.GEMINI_API_KEYS = originalGeminiApiKeys;
      }
    }
  }
}

async function main() {
  loadEnvConfig(path.resolve(process.cwd()));
  loadEnvConfig(path.resolve(process.cwd(), "../.."));
  installServerOnlyShim();

  const args = parseArgs();
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const serviceRoleKey = requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY"
  );
  requireEnv("GEMINI_API_KEY");
  requireEnv("DEEPSEEK_API_KEY");
  process.env.PRACTICE_JUDGE_FALLBACK_PROVIDER = "deepseek";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const profile = await resolveShadowProfile(
    supabase,
    args.get("email") ?? process.env.PRACTICE_JUDGE_SHADOW_EMAIL
  );

  const happy = await runScenario({
    supabase,
    userId: profile.id,
    scenario: "gemini_happy",
  });
  assert.equal(happy.providerRequests[0]?.provider, "google");
  assert.ok(
    happy.providerRequests.every((request) => request.provider !== "deepseek"),
    "Gemini happy path should not call DeepSeek"
  );

  const fallback = await runScenario({
    supabase,
    userId: profile.id,
    scenario: "gemini_failure_deepseek_fallback",
    forceGeminiFailure: true,
  });
  const fallbackProviders = fallback.providerRequests.map(
    (request) => request.provider
  );
  assert.equal(fallbackProviders[0], "google");
  assert.ok(
    fallbackProviders.slice(1).includes("deepseek"),
    "Fallback scenario should call DeepSeek after Gemini fails"
  );
  assert.equal(fallback.provider, "deepseek");

  const { getStudentFeedbackErrorMessage, STUDENT_FEEDBACK_FAILURE_MESSAGE } =
    await import("../apps/web/src/lib/practice-feedback-errors");
  assert.equal(
    getStudentFeedbackErrorMessage(
      new Error(
        "DeepSeek returned an empty response (finish_reason=unknown, reasoning_chars=0)"
      )
    ),
    STUDENT_FEEDBACK_FAILURE_MESSAGE
  );

  const maxHappyMs = Number(process.env.PRACTICE_JUDGE_SHADOW_MAX_HAPPY_MS ?? 60000);
  assert.ok(
    happy.elapsedMs <= maxHappyMs,
    `Gemini happy path took ${happy.elapsedMs}ms, above ${maxHappyMs}ms`
  );

  console.info(
    JSON.stringify(
      {
        user: {
          id: profile.id,
          email: maskEmail(profile.email),
          role: profile.role ?? null,
        },
        happy,
        fallback,
        sanitizer: "passed",
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
