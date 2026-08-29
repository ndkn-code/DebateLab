import type { AiTask, AiTaskPolicy } from "./contracts";

const geminiModel = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";
const groqModel = () => process.env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile";
const deepSeekModel = () => process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

/**
 * This is deliberately a small task registry, not an implicit provider default.
 * New AI product work must choose a task so its fallback and latency behaviour is
 * reviewable in one place.
 */
export function getAiTaskPolicy(task: AiTask): AiTaskPolicy {
  switch (task) {
    case "stt_transcript_repair":
      return {
        candidates: [{ provider: "gemini", model: process.env.GEMINI_STT_REPAIR_MODEL || geminiModel() }],
        attemptTimeoutMs: 15_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 4_096,
        temperature: 0,
        criticality: "best_effort",
      };
    case "practice_judging":
      return {
        candidates: [
          { provider: "gemini", model: process.env.GEMINI_FULL_ROUND_JUDGE_MODEL || geminiModel() },
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
      return {
        candidates: [
          { provider: "gemini", model: geminiModel() },
          { provider: "groq", model: groqModel() },
        ],
        attemptTimeoutMs: 35_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 4_096,
        temperature: 0.2,
        criticality: "critical",
      };
    case "coach_chat":
      return {
        candidates: [{ provider: "groq", model: groqModel() }],
        attemptTimeoutMs: 35_000,
        schemaRepairAttempts: 0,
        maxOutputTokens: 1_600,
        temperature: 0.35,
        criticality: "best_effort",
      };
    case "coach_metadata":
      return {
        candidates: [{ provider: "groq", model: groqModel() }],
        attemptTimeoutMs: 18_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 900,
        temperature: 0.2,
        criticality: "best_effort",
      };
    case "coach_title":
      return {
        candidates: [{ provider: "groq", model: groqModel() }],
        attemptTimeoutMs: 8_000,
        schemaRepairAttempts: 0,
        maxOutputTokens: 24,
        temperature: 0.3,
        criticality: "best_effort",
      };
    case "coach_visualization":
      return {
        candidates: [
          { provider: "gemini", model: process.env.GEMINI_VISUAL_PLANNER_MODEL || "gemini-3.1-flash-lite" },
          { provider: "gemini", model: "gemma-4-31b-it" },
          { provider: "gemini", model: "gemma-4-26b-a4b-it" },
          { provider: "groq", model: groqModel() },
        ],
        attemptTimeoutMs: 20_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 1_200,
        temperature: 0.2,
        criticality: "best_effort",
      };
    case "rebuttal":
      return {
        candidates: [
          { provider: "gemini", model: geminiModel() },
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
          { provider: "gemini", model: geminiModel() },
        ],
        attemptTimeoutMs: 40_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 1_600,
        temperature: 0.7,
        criticality: "critical",
      };
    case "duel_judging": {
      const deepSeekPrimary = process.env.DEBATE_DUEL_JUDGE_PROVIDER === "deepseek";
      return {
        candidates: deepSeekPrimary
          ? [
              { provider: "deepseek", model: deepSeekModel() },
              { provider: "gemini", model: geminiModel() },
            ]
          : [
              { provider: "gemini", model: geminiModel() },
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
        candidates: [{ provider: "gemini", model: geminiModel() }],
        attemptTimeoutMs: 10_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 300,
        temperature: 0.5,
        criticality: "best_effort",
      };
    case "ielts_micro_drafts":
      return {
        candidates: [
          { provider: "gemini", model: geminiModel() },
          { provider: "groq", model: groqModel() },
        ],
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
          { provider: "gemini", model: geminiModel() },
        ],
        attemptTimeoutMs: 9_000,
        schemaRepairAttempts: 1,
        maxOutputTokens: 900,
        temperature: 0.35,
        criticality: "best_effort",
      };
  }
}
