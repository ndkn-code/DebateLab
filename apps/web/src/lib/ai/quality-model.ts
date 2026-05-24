import type { PracticeLanguage, PracticeTrack } from "@/types/feedback";

export const AI_QUALITY_OUTPUT_TYPES = [
  "rebuttal",
  "practice_judging",
  "duel_judging",
] as const;

export const AI_QUALITY_USEFULNESS_VALUES = ["yes", "somewhat", "no"] as const;
export const AI_QUALITY_FAIRNESS_VALUES = [
  "too_harsh",
  "fair",
  "too_generous",
] as const;
export const AI_QUALITY_REASON_TAGS = [
  "too_generic",
  "missed_argument",
  "wrong_winner",
  "score_felt_wrong",
  "vietnamese_sounded_weird",
  "hallucinated_evidence",
  "too_harsh",
  "too_easy",
  "latency_too_slow",
] as const;
export const AI_QUALITY_REVIEW_STATUSES = [
  "unreviewed",
  "reviewed",
  "flagged",
  "ignored",
] as const;

export type AiQualityOutputType = (typeof AI_QUALITY_OUTPUT_TYPES)[number];
export type AiQualityUsefulness = (typeof AI_QUALITY_USEFULNESS_VALUES)[number];
export type AiQualityFairness = (typeof AI_QUALITY_FAIRNESS_VALUES)[number];
export type AiQualityReasonTag = (typeof AI_QUALITY_REASON_TAGS)[number];
export type AiQualityReviewStatus = (typeof AI_QUALITY_REVIEW_STATUSES)[number];
export type AiQualityStatus = "success" | "error";

export interface AiQualityTokenUsage {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  cacheHitTokens?: number | null;
  cacheMissTokens?: number | null;
  reasoningTokens?: number | null;
}

export interface AiQualityTelemetry {
  provider: string;
  requestedProvider?: string | null;
  model: string;
  latencyMs?: number | null;
  usage?: AiQualityTokenUsage;
  fallbackUsed?: boolean;
  status?: AiQualityStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface AiQualityRunInput extends AiQualityTelemetry {
  userId: string;
  outputType: AiQualityOutputType;
  sourceRoute?: string | null;
  promptBundleKey?: string | null;
  promptBundleVersion?: number | null;
  promptHash?: string | null;
  rubricKey?: string | null;
  rubricVersion?: number | null;
  practiceTrack?: PracticeTrack | null;
  practiceLanguage?: PracticeLanguage | null;
  difficulty?: string | null;
  debateFormat?: string | null;
  side?: "proposition" | "opposition" | null;
  aiSide?: "proposition" | "opposition" | null;
  topicTitle?: string | null;
  winner?: "user" | "ai" | "tie" | "proposition" | "opposition" | null;
  score?: number | null;
  confidence?: number | null;
  outputText?: string | null;
  inputPreview?: string | null;
  practiceAttemptId?: string | null;
  analysisJobId?: string | null;
  debateSessionId?: string | null;
  debateDuelId?: string | null;
  debateDuelJudgmentId?: string | null;
  metadata?: Record<string, unknown>;
  estimatedCostUsd?: number | null;
}

export interface AiQualityRatingInput {
  runId: string;
  userId: string;
  usefulness?: AiQualityUsefulness | null;
  fairness?: AiQualityFairness | null;
  reasonTags?: AiQualityReasonTag[];
  comment?: string | null;
  locale?: PracticeLanguage | null;
  route?: string | null;
}

const DEEPSEEK_PRICING_PER_1M = {
  cacheHitInput: 0.0028,
  cacheMissInput: 0.14,
  input: 0.14,
  output: 0.28,
};

function safeCount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function normalizeProvider(value: string) {
  return value.trim().toLowerCase();
}

export function estimateAiCostUsd(input: {
  provider: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cacheHitTokens?: number | null;
  cacheMissTokens?: number | null;
}) {
  if (!normalizeProvider(input.provider).includes("deepseek")) {
    return 0;
  }

  const cacheHitTokens = safeCount(input.cacheHitTokens);
  const cacheMissTokens = safeCount(input.cacheMissTokens);
  const uncachedInputTokens =
    cacheHitTokens || cacheMissTokens
      ? 0
      : safeCount(input.inputTokens);
  const outputTokens = safeCount(input.outputTokens);

  const cost =
    (cacheHitTokens / 1_000_000) * DEEPSEEK_PRICING_PER_1M.cacheHitInput +
    (cacheMissTokens / 1_000_000) * DEEPSEEK_PRICING_PER_1M.cacheMissInput +
    (uncachedInputTokens / 1_000_000) * DEEPSEEK_PRICING_PER_1M.input +
    (outputTokens / 1_000_000) * DEEPSEEK_PRICING_PER_1M.output;

  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function createAiQualityPreview(value: string | null | undefined, max = 600) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

export function isAiQualityReasonTag(value: string): value is AiQualityReasonTag {
  return (AI_QUALITY_REASON_TAGS as readonly string[]).includes(value);
}

export function normalizeAiQualityReasonTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(isAiQualityReasonTag)
    )
  ).slice(0, 8);
}

export function isNegativeAiQualityRating(input: {
  usefulness?: AiQualityUsefulness | null;
  fairness?: AiQualityFairness | null;
  reasonTags?: AiQualityReasonTag[] | null;
}) {
  return Boolean(
    input.usefulness === "somewhat" ||
      input.usefulness === "no" ||
      (input.fairness && input.fairness !== "fair") ||
      (input.reasonTags?.length ?? 0) > 0
  );
}
