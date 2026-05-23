import type { PracticeTrack } from "@/types";

export type AiProvider = "gemini" | "deepseek";

function normalizeProvider(value: string | undefined, fallback: AiProvider): AiProvider {
  const normalized = value?.trim().toLowerCase();
  return normalized === "deepseek" || normalized === "gemini"
    ? normalized
    : fallback;
}

export function getRebuttalProvider() {
  return normalizeProvider(process.env.DEBATE_AI_REBUTTAL_PROVIDER, "gemini");
}

export function getPracticeFeedbackProvider(track: PracticeTrack = "debate") {
  if (track === "speaking") {
    return normalizeProvider(process.env.SPEAKING_AI_FEEDBACK_PROVIDER, "gemini");
  }

  return normalizeProvider(process.env.DEBATE_AI_FEEDBACK_PROVIDER, "gemini");
}

export function getDuelJudgeProvider() {
  return normalizeProvider(process.env.DEBATE_DUEL_JUDGE_PROVIDER, "gemini");
}

export function getProviderModelName(provider: AiProvider) {
  return provider === "deepseek"
    ? process.env.DEEPSEEK_MODEL || "deepseek-v4-flash"
    : process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

export function getProviderLabel(provider: AiProvider) {
  return provider === "deepseek" ? "deepseek" : "google";
}
