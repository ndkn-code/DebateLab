import { getGroqChatModelName } from "@/lib/ai/groq";

/** Live student scoring never sends candidate material to Gemini. */
export const IELTS_SPEAKING_GROQ_PROVIDER_LABEL = "groq";

export function getIeltsSpeakingGroqModelName(): string {
  return process.env.GROQ_IELTS_SPEAKING_MODEL || getGroqChatModelName();
}
