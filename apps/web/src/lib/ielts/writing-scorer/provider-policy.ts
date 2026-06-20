/**
 * Cheap-first provider policy for the IELTS Writing scorer (WS-3.1, masterplan
 * §11): Gemini Flash (key-pool) by default, DeepSeek as the configurable
 * fallback, Claude only where nuance truly demands it (not wired here). Mirrors
 * the debate provider-selection env pattern but lives in the IELTS module so the
 * core stays untouched.
 */
import {
  getProviderLabel,
  getProviderModelName,
  type AiProvider,
} from "@/lib/ai/provider-selection";

function normalizeProvider(
  value: string | undefined,
  fallback: AiProvider,
): AiProvider {
  const normalized = value?.trim().toLowerCase();
  return normalized === "deepseek" || normalized === "gemini"
    ? normalized
    : fallback;
}

/** Primary provider for Writing scoring (default: Gemini Flash). */
export function getIeltsWritingScoreProvider(): AiProvider {
  return normalizeProvider(process.env.IELTS_WRITING_SCORE_PROVIDER, "gemini");
}

/** Whether to fall back to DeepSeek when the primary provider fails. */
export function isIeltsWritingFallbackEnabled(): boolean {
  const normalized = process.env.IELTS_WRITING_FALLBACK_PROVIDER
    ?.trim()
    .toLowerCase();
  return !(
    normalized === "none" ||
    normalized === "off" ||
    normalized === "false" ||
    normalized === "disabled"
  );
}

export function getIeltsWritingModelName(provider: AiProvider): string {
  return getProviderModelName(provider);
}

export function getIeltsWritingProviderLabel(provider: AiProvider): string {
  return getProviderLabel(provider);
}
