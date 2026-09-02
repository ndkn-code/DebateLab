import {
  getGroqGradingPrimaryModel,
  getIeltsScoringCandidates,
} from "@/lib/ai/core/policies";

/** Live student scoring never sends candidate material to Gemini. */
export const IELTS_SPEAKING_GROQ_PROVIDER_LABEL = "groq";

export function getIeltsSpeakingGroqModelName(): string {
  return getGroqGradingPrimaryModel();
}

export function getIeltsSpeakingScoringPolicy(
  stage: "provisional" | "adjudicated",
) {
  return {
    candidates: getIeltsScoringCandidates(getIeltsSpeakingGroqModelName()),
    maxOutputTokens: 3_072,
    temperature: stage === "provisional" ? 0.2 : 0,
  } as const;
}
