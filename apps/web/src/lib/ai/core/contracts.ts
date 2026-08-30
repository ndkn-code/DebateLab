import type { z } from "zod";

export const AI_TASKS = [
  "practice_judging",
  "ielts_speaking_score",
  "ielts_writing_score",
  "ielts_speaking_adjudication",
  "ielts_writing_adjudication",
  "stt_transcript_repair",
  "coach_chat",
  "coach_metadata",
  "ielts_coach_chat",
  "ielts_coach_metadata",
  "coach_title",
  "coach_visualization",
  "rebuttal",
  "duel_ai_speech",
  "duel_judging",
  "onboarding_feedback",
  "ielts_micro_drafts",
  "truong_teen_case_plan",
] as const;

export type AiTask = (typeof AI_TASKS)[number];
export type AiProvider = "gemini" | "groq" | "deepseek";
export type AiFailureKind =
  | "misconfiguration"
  | "invalid_request"
  | "rate_limited"
  | "provider_unavailable"
  | "deadline_exceeded"
  | "schema_invalid"
  | "budget_exhausted"
  | "unknown";

export interface AiExecutionContext {
  task: AiTask;
  /** Stable across every provider call belonging to one user action or job. */
  traceId?: string;
  /** Stable across duplicate queue deliveries or request retries. */
  idempotencyKey?: string;
  userId?: string | null;
  sourceRoute: string;
  outputType: string;
  deadlineAt?: number;
  entity?: {
    practiceAttemptId?: string;
    analysisJobId?: string;
    speakingResponseId?: string;
    writingResponseId?: string;
    debateSessionId?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface AiModelCandidate {
  provider: AiProvider;
  model: string;
}

export interface AiTaskPolicy {
  candidates: readonly AiModelCandidate[];
  /** Per network call. The total context deadline still wins. */
  attemptTimeoutMs: number;
  /** One corrective re-prompt handles bad JSON without runaway retries. */
  schemaRepairAttempts: number;
  maxOutputTokens: number;
  temperature: number;
  criticality: "critical" | "best_effort";
}

export interface AiPromptMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiStructuredRequest<T> {
  task: AiTask;
  prompt: string;
  messages?: AiPromptMessage[];
  schema: z.ZodType<T>;
  context: AiExecutionContext;
  /** Override only for prompts with an established product-specific contract. */
  policy?: Partial<AiTaskPolicy>;
  repairInstruction?: string;
}

export interface AiTextRequest {
  task: AiTask;
  messages: AiPromptMessage[];
  context: AiExecutionContext;
  policy?: Partial<AiTaskPolicy>;
  /** Streaming-only hook used to report the provider that emitted the answer. */
  onProviderSelected?: (selection: {
    provider: AiProvider;
    model: string;
    traceId: string;
  }) => void;
}

export interface AiUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheHitTokens?: number;
  cacheMissTokens?: number;
  reasoningTokens?: number;
}

export interface AiAttempt {
  provider: AiProvider;
  model: string;
  status: "success" | "error";
  latencyMs: number;
  failureKind?: AiFailureKind;
  providerRequestId?: string | null;
}

export interface AiResult<T> {
  output: T;
  text: string;
  provider: AiProvider;
  model: string;
  usage: AiUsage;
  latencyMs: number;
  traceId: string;
  fallbackUsed: boolean;
  attempts: AiAttempt[];
  providerRequestIds: string[];
}

export class AiExecutionError extends Error {
  readonly kind: AiFailureKind;
  readonly retryAfterMs?: number;
  readonly attempts: AiAttempt[];

  constructor(params: {
    message: string;
    kind: AiFailureKind;
    retryAfterMs?: number;
    attempts?: AiAttempt[];
    cause?: unknown;
  }) {
    super(params.message, { cause: params.cause });
    this.name = "AiExecutionError";
    this.kind = params.kind;
    this.retryAfterMs = params.retryAfterMs;
    this.attempts = params.attempts ?? [];
  }
}
