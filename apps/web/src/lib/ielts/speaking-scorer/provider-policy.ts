/**
 * Cheap-first provider policy for the IELTS Speaking scorer (WS-3.2, masterplan
 * §11): Gemini Flash (key-pool) by default, Groq (`llama-3.3-70b-versatile`) as
 * the configurable fallback — explicitly NOT DeepSeek. Claude only where nuance
 * truly demands it (not wired here). Mirrors the Writing provider-policy but
 * swaps the fallback to Groq, which is already wired for STT.
 */
import {
  getProviderLabel,
  getProviderModelName,
} from "@/lib/ai/provider-selection";
import { getGroqChatModelName } from "@/lib/ai/groq";

/** Primary scoring model: Gemini Flash (via the key-pool). */
export function getIeltsSpeakingGeminiModelName(): string {
  return getProviderModelName("gemini");
}

export function getIeltsSpeakingGeminiProviderLabel(): string {
  return getProviderLabel("gemini");
}

/** Fallback scoring model: Groq chat. */
export const IELTS_SPEAKING_GROQ_PROVIDER_LABEL = "groq";

export function getIeltsSpeakingGroqModelName(): string {
  return getGroqChatModelName();
}

/** Whether to fall back to Groq when the primary (Gemini) fails. */
export function isIeltsSpeakingFallbackEnabled(): boolean {
  const normalized = process.env.IELTS_SPEAKING_FALLBACK_PROVIDER
    ?.trim()
    .toLowerCase();
  return !(
    normalized === "none" ||
    normalized === "off" ||
    normalized === "false" ||
    normalized === "disabled"
  );
}
