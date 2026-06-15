import type { PracticeTrack } from "@/types";

export type AiProvider = "gemini" | "deepseek";
export type PracticeJudgeFallbackProvider = "deepseek" | "none";

function normalizeProvider(value: string | undefined, fallback: AiProvider): AiProvider {
  const normalized = value?.trim().toLowerCase();
  return normalized === "deepseek" || normalized === "gemini"
    ? normalized
    : fallback;
}

export function getRebuttalProvider(): AiProvider {
  return normalizeProvider(process.env.DEBATE_AI_REBUTTAL_PROVIDER, "gemini");
}

export function getPracticeFeedbackProvider(
  track: PracticeTrack = "debate"
): AiProvider {
  void track;
  return "gemini";
}

export function getPracticeJudgeFallbackProvider(): PracticeJudgeFallbackProvider {
  const normalized = process.env.PRACTICE_JUDGE_FALLBACK_PROVIDER
    ?.trim()
    .toLowerCase();

  if (
    normalized === "none" ||
    normalized === "off" ||
    normalized === "false" ||
    normalized === "disabled"
  ) {
    return "none";
  }

  return "deepseek";
}

export function getDuelJudgeProvider(): AiProvider {
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
