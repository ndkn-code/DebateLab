import { getIeltsScoringCandidates } from "@/lib/ai/core/policies";

/** Live student scoring never sends candidate material to Gemini. */
export function getIeltsWritingGroqModelName(): string {
  return (
    process.env.GROQ_IELTS_WRITING_MODEL ||
    process.env.GROQ_CHAT_MODEL ||
    "openai/gpt-oss-120b"
  );
}

export function getIeltsWritingScoringPolicy(
  stage: "provisional" | "adjudicated",
) {
  return {
    candidates: getIeltsScoringCandidates(getIeltsWritingGroqModelName()),
    maxOutputTokens: 4_096,
    temperature: stage === "provisional" ? 0.2 : 0,
  } as const;
}
