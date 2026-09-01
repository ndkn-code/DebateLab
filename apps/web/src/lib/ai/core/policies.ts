import type { AiTask, AiTaskPolicy } from "./contracts";

const groqModel = () => process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-120b";
export const getIeltsScoringFallbackModel = () =>
  process.env.GROQ_IELTS_SCORING_FALLBACK_MODEL || "openai/gpt-oss-20b";
export const getGeminiCoachModel = () =>
  process.env.GEMINI_COACH_MODEL || "gemini-3.5-flash-lite";
export const getGroqCoachFallbackModel = () =>
  process.env.GROQ_COACH_FALLBACK_MODEL || "openai/gpt-oss-20b";
const getIeltsCoachPrimaryModel = () =>
  process.env.GROQ_IELTS_COACH_MODEL || "qwen/qwen3.8-27b";
const getIeltsCoachFallbackModel = () =>
  process.env.GROQ_IELTS_COACH_FALLBACK_MODEL || getGroqCoachFallbackModel();
const deepSeekModel = () => process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

/** Gemini is only added after the product surface has collected consent. */
export function getCoachChatCandidates(allowGemini: boolean) {
  return allowGemini
    ? [
        { provider: "gemini" as const, model: getGeminiCoachModel() },
        { provider: "groq" as const, model: getGroqCoachFallbackModel() },
      ]
    : [
        {
          provider: "groq" as const,
          model: getGroqCoachFallbackModel(),
        },
      ];
}

/**
 * IELTS Coach is likely to be accessed by minors, so it uses the existing
 * Groq transport only. The second production model is a bounded fallback and
 * is removed when an operator deliberately configures both names identically.
 */
export function getIeltsCoachCandidates(allowGemini = false) {
  const primary = getIeltsCoachPrimaryModel();
  const fallback = getIeltsCoachFallbackModel();
  const groqCandidates = [primary, fallback]
    .filter((model, index, models) => models.indexOf(model) === index)
    .map((model) => ({ provider: "groq" as const, model }));
  return allowGemini
    ? [
        { provider: "gemini" as const, model: getGeminiCoachModel() },
        ...groqCandidates,
      ]
    : groqCandidates;
}

/**
 * Live IELTS grading stays on Groq, with a smaller fast model as the bounded
 * fallback for a primary model rate limit or outage. Separate model quotas
 * also prevent two Writing tasks from stranding the same simulation burst.
 */
export function getIeltsScoringCandidates(primaryModel = groqModel()) {
  return [primaryModel, getIeltsScoringFallbackModel()]
    .filter((model, index, models) => models.indexOf(model) === index)
    .map((model) => ({ provider: "groq" as const, model }));
}

/**
 * This is deliberately a small task registry, not an implicit provider default.
 * New AI product work must choose a task so its fallback and latency behaviour is
 * reviewable in one place.
 */
export function getAiTaskPolicy(task: AiTask): AiTaskPolicy {
  switch (task) {
    case "stt_transcript_repair":
      return {
        candidates: [
          {
            provider: "groq",
            model: process.env.GROQ_STT_REPAIR_MODEL || groqModel(),
          },
        ],
        attemptTimeoutMs: 15_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 4_096,
        temperature: 0,
        criticality: "best_effort",
      };
    case "practice_judging":
      return {
        candidates: [
          {
            provider: "groq",
            model: process.env.GROQ_FULL_ROUND_JUDGE_MODEL || groqModel(),
          },
          { provider: "deepseek", model: deepSeekModel() },
        ],
        attemptTimeoutMs: 35_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 8_192,
        temperature: 0.25,
        criticality: "critical",
      };
    case "ielts_speaking_score":
    case "ielts_writing_score":
    case "ielts_speaking_adjudication":
    case "ielts_writing_adjudication":
      return {
        // Student submissions may belong to minors. Gemini's current API terms
        // prohibit use in services directed to, or likely accessed by, minors,
        // so live grading deliberately has no Gemini candidate or fallback.
        candidates: getIeltsScoringCandidates(),
        attemptTimeoutMs: 35_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 4_096,
        temperature: 0.2,
        criticality: "critical",
      };
    case "coach_chat":
      return {
        candidates: [{ provider: "groq", model: getGroqCoachFallbackModel() }],
        attemptTimeoutMs: 35_000,
        schemaRepairAttempts: 0,
        maxOutputTokens: 1_600,
        temperature: 0.35,
        criticality: "best_effort",
      };
    case "coach_metadata":
      return {
        candidates: [{ provider: "groq", model: getGroqCoachFallbackModel() }],
        attemptTimeoutMs: 18_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 900,
        temperature: 0.2,
        criticality: "best_effort",
      };
    case "ielts_coach_chat":
      return {
        candidates: getIeltsCoachCandidates(),
        attemptTimeoutMs: 6_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 1_400,
        temperature: 0.25,
        criticality: "best_effort",
      };
    case "ielts_coach_metadata":
      return {
        candidates: getIeltsCoachCandidates(),
        attemptTimeoutMs: 6_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 1_200,
        temperature: 0.1,
        criticality: "best_effort",
      };
    case "coach_title":
      return {
        candidates: [{ provider: "groq", model: getGroqCoachFallbackModel() }],
        attemptTimeoutMs: 8_000,
        schemaRepairAttempts: 0,
        maxOutputTokens: 24,
        temperature: 0.3,
        criticality: "best_effort",
      };
    case "coach_visualization":
      return {
        candidates: [{ provider: "groq", model: getGroqCoachFallbackModel() }],
        attemptTimeoutMs: 20_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 1_200,
        temperature: 0.2,
        criticality: "best_effort",
      };
    case "rebuttal":
      return {
        candidates: [
          { provider: "groq", model: groqModel() },
          { provider: "deepseek", model: deepSeekModel() },
        ],
        attemptTimeoutMs: 45_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 8_192,
        temperature: 0.7,
        criticality: "critical",
      };
    case "duel_ai_speech":
      return {
        candidates: [
          { provider: "deepseek", model: deepSeekModel() },
          { provider: "groq", model: groqModel() },
        ],
        attemptTimeoutMs: 40_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 1_600,
        temperature: 0.7,
        criticality: "critical",
      };
    case "duel_judging": {
      const deepSeekPrimary =
        process.env.DEBATE_DUEL_JUDGE_PROVIDER === "deepseek";
      return {
        candidates: deepSeekPrimary
          ? [
              { provider: "deepseek", model: deepSeekModel() },
              { provider: "groq", model: groqModel() },
            ]
          : [
              { provider: "groq", model: groqModel() },
              { provider: "deepseek", model: deepSeekModel() },
            ],
        attemptTimeoutMs: 45_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 8_192,
        temperature: 0.2,
        criticality: "critical",
      };
    }
    case "onboarding_feedback":
      return {
        candidates: [{ provider: "groq", model: groqModel() }],
        attemptTimeoutMs: 10_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 300,
        temperature: 0.5,
        criticality: "best_effort",
      };
    case "ielts_micro_drafts":
      return {
        candidates: [{ provider: "groq", model: groqModel() }],
        attemptTimeoutMs: 35_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 4_096,
        temperature: 0.15,
        criticality: "critical",
      };
    case "truong_teen_case_plan":
      return {
        candidates: [
          { provider: "deepseek", model: deepSeekModel() },
          { provider: "groq", model: groqModel() },
        ],
        attemptTimeoutMs: 9_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 900,
        temperature: 0.35,
        criticality: "best_effort",
      };
  }
}
