import { z } from "zod";
import { normalizeDebateScore } from "@/lib/gemini";
import { getDebateFeedbackDepthTarget, isFeedbackBelowDepthTarget } from "@/lib/feedback/depth";
import { needsVietnameseProseRepair } from "@/lib/feedback/language-repair";
import { buildAnalysisPrompt } from "@/lib/prompts";
import type { DebateScore } from "@/types/feedback";
import { generateStructured } from "./execute";

/**
 * Compatibility adapter for the existing debate prompt/normalization contract.
 * Durable and synchronous evaluators call the AI core boundary rather than the
 * legacy provider module directly while staged-provider extraction is rolled out.
 */
export const DebateFeedbackEnvelopeSchema = z.object({
  content: z.object({ score: z.number(), claimClarity: z.number(), evidenceSupport: z.number(), logicCoherence: z.number(), counterArgument: z.number() }),
  structure: z.object({ score: z.number(), introduction: z.number(), bodyOrganization: z.number(), conclusion: z.number() }),
  language: z.object({ score: z.number(), vocabulary: z.number(), grammar: z.number(), fluency: z.number() }),
  persuasion: z.object({ score: z.number(), audienceAwareness: z.number(), impactfulness: z.number() }),
  totalScore: z.number(),
  overallBand: z.string().min(1),
  summary: z.string().min(1),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  sampleArguments: z.array(z.string()),
  detailedFeedback: z.object({
    contentFeedback: z.string().min(1),
    structureFeedback: z.string().min(1),
    languageFeedback: z.string().min(1),
    persuasionFeedback: z.string().min(1),
  }),
}).passthrough();

type LegacyInput = Parameters<typeof buildAnalysisPrompt>[0] & {
  providerAudit?: {
    sourceRoute?: string;
    practiceAttemptId?: string;
    analysisJobId?: string;
    metadata?: Record<string, unknown>;
  };
};
type Telemetry = {
  provider: string;
  requestedProvider?: string | null;
  model: string;
  latencyMs?: number | null;
  usage?: { inputTokens?: number | null; outputTokens?: number | null; totalTokens?: number | null };
  providerRequestIds?: string[];
  fallbackUsed?: boolean;
  metadata?: Record<string, unknown>;
};

/**
 * Central compatibility evaluator. It retains the existing prompt and result
 * normalizer while moving deadline, schema repair, fallback, and request audit
 * responsibility to `generateStructured`.
 */
export async function generatePracticeFeedback(
  input: LegacyInput,
  userId?: string,
  onTelemetry?: (telemetry: Telemetry) => void | Promise<void>,
): Promise<DebateScore> {
  const sourceRoute = input.providerAudit?.sourceRoute ?? "/api/analyze";
  const syncRoute = sourceRoute === "/api/analyze";
  const maxOutputTokens = input.practiceTrack !== "speaking" && input.isFullRound ? 12_000 : 6_144;
  const startedAt = Date.now();
  // One budget is shared by the base judgment and optional quality repair.
  // This keeps the synchronous route below its function limit while allowing
  // durable full-round jobs to correct shallow-but-schema-valid ballots.
  const deadlineAt = Date.now() + (syncRoute ? 50_000 : 75_000);
  const prompt = buildAnalysisPrompt(input);
  let result = await generateStructured({
    task: "practice_judging",
    prompt,
    schema: DebateFeedbackEnvelopeSchema,
    context: {
      task: "practice_judging",
      sourceRoute,
      outputType: "practice_judging",
      userId,
      // The synchronous legacy endpoint is capped at 60 seconds; durable jobs
      // have a larger bounded budget and may resume from their own workflow state.
      deadlineAt,
      idempotencyKey: input.providerAudit?.analysisJobId ?? undefined,
      entity: {
        practiceAttemptId: input.providerAudit?.practiceAttemptId,
        analysisJobId: input.providerAudit?.analysisJobId,
      },
      metadata: input.providerAudit?.metadata,
    },
    policy: { maxOutputTokens },
  });
  let feedback = normalizeDebateScore(result.output as unknown as DebateScore, input);
  let qualityRepair = false;
  const providerRequestIds = [...result.providerRequestIds];
  let fallbackUsed = result.fallbackUsed;

  const isFullDebateRound = input.practiceTrack !== "speaking" && input.isFullRound;
  const depthTarget = getDebateFeedbackDepthTarget({
    isFullRound: Boolean(isFullDebateRound),
    actualDuration: input.actualDuration,
    roundCount: input.rounds?.length,
  });
  if (isFullDebateRound && isFeedbackBelowDepthTarget(feedback, depthTarget)) {
    try {
      result = await generateStructured({
        task: "practice_judging",
        prompt: `${prompt}

## Existing Feedback To Repair
${JSON.stringify(feedback)}

## Depth Repair Instruction
The existing feedback is too shallow for a full-round debate. Return the full JSON schema again, preserving valid scores when reasonable, but expand coverage to at least ${depthTarget.minArgumentBreakdowns} argumentBreakdowns, ${depthTarget.minAnnotations} transcriptAnnotations, ${depthTarget.minClashLinks} clashLinks, and a complete scoreRationale. Do not invent transcript quotes; use exact quotes from the transcript above.`,
        schema: DebateFeedbackEnvelopeSchema,
        context: {
          task: "practice_judging",
          sourceRoute,
          outputType: "practice_judging",
          userId,
          traceId: result.traceId,
          idempotencyKey: input.providerAudit?.analysisJobId ?? undefined,
          deadlineAt,
          entity: {
            practiceAttemptId: input.providerAudit?.practiceAttemptId,
            analysisJobId: input.providerAudit?.analysisJobId,
          },
          metadata: { phase: "depth_repair", ...(input.providerAudit?.metadata ?? {}) },
        },
        // The repair has the remaining shared deadline, with no internal
        // schema-repair loop so it cannot consume the whole full-round budget.
        policy: { maxOutputTokens, schemaRepairAttempts: 0 },
      });
      feedback = normalizeDebateScore(result.output as unknown as DebateScore, input);
      providerRequestIds.push(...result.providerRequestIds);
      fallbackUsed ||= result.fallbackUsed;
      qualityRepair = true;
    } catch {
      // Preserve a valid initial ballot if the optional quality pass runs out
      // of time or a provider is unavailable; its failed attempt is audited by
      // the core and must not erase learner feedback.
    }
  }

  if (input.practiceLanguage === "vi" && needsVietnameseProseRepair(feedback)) {
    try {
      result = await generateStructured({
        task: "practice_judging",
        prompt: `${prompt}

## Previous JSON With Language Violation
${JSON.stringify(feedback)}

## Vietnamese Repair Instruction
The previous JSON used English in user-facing prose even though the practice language is Vietnamese. Return the full JSON schema again. Keep every schema key and enum literal in English, preserve numeric scores and exact transcript quote fields, and rewrite all learner-facing explanation fields in natural Vietnamese with diacritics. JSON only.`,
        schema: DebateFeedbackEnvelopeSchema,
        context: {
          task: "practice_judging",
          sourceRoute,
          outputType: "practice_judging",
          userId,
          traceId: result.traceId,
          idempotencyKey: input.providerAudit?.analysisJobId ?? undefined,
          deadlineAt,
          entity: {
            practiceAttemptId: input.providerAudit?.practiceAttemptId,
            analysisJobId: input.providerAudit?.analysisJobId,
          },
          metadata: { phase: "language_repair", ...(input.providerAudit?.metadata ?? {}) },
        },
        policy: { maxOutputTokens, schemaRepairAttempts: 0 },
      });
      feedback = normalizeDebateScore(result.output as unknown as DebateScore, input);
      providerRequestIds.push(...result.providerRequestIds);
      fallbackUsed ||= result.fallbackUsed;
      qualityRepair = true;
    } catch {
      // Same best-effort rule as depth repair: a valid score is preferable to
      // failing an otherwise completed practice analysis.
    }
  }
  await onTelemetry?.({
    provider: result.provider === "gemini" ? "google" : result.provider,
    requestedProvider: "google",
    model: result.model,
    latencyMs: Date.now() - startedAt,
    usage: result.usage,
    providerRequestIds: [...new Set(providerRequestIds)],
    fallbackUsed,
    metadata: {
      judgePipeline: "core_structured",
      traceId: result.traceId,
      qualityRepair,
    },
  });
  return feedback;
}
