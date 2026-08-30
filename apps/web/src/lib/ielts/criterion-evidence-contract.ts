import { z } from "zod";
import {
  WRITING_CRITERIA,
  type WritingCriterionKey,
} from "@/lib/scoring/ielts-writing/band-math";
import {
  SPEAKING_CRITERIA,
  type SpeakingCriterionKey,
} from "@/lib/scoring/ielts-speaking/band-math";
import type { NormalizedWritingScore } from "@/lib/scoring/ielts-writing/normalize";
import type { NormalizedSpeakingScore } from "@/lib/scoring/ielts-speaking/normalize";
import type { Json } from "@/types/supabase";
import { JsonSchema } from "@/lib/api/ielts/json";

export const IELTS_PROVISIONAL_EVIDENCE_VERSION = "provisional-v1";
export const IELTS_CRITERION_EVIDENCE_STAGES = [
  "provisional",
  "adjudicated",
] as const;
export type IeltsCriterionEvidenceStage =
  (typeof IELTS_CRITERION_EVIDENCE_STAGES)[number];

const commonEvidenceFields = {
  band: z
    .number()
    .finite()
    .min(0)
    .max(9)
    .refine(
      (value) => value * 2 === Math.trunc(value * 2),
      "band must be on the IELTS half-band grid",
    ),
  rationale: z.string().min(1).max(2000),
  stage: z.enum(IELTS_CRITERION_EVIDENCE_STAGES),
  gradingVersion: z.string().min(1).max(100),
  traceId: z.string().min(1).max(200),
  runId: z.string().min(1).max(200),
  provider: z.string().min(1).max(100),
  model: z.string().min(1).max(200),
  rubricVersion: z.string().min(1).max(100),
  promptVersion: z.string().min(1).max(100),
  confidence: z.number().finite().min(0).max(1),
  workflowAttempt: z.number().int().nonnegative(),
  providerAttempt: z.number().int().nonnegative(),
  validatedOutputSnapshot: JsonSchema,
  deterministicHash: z.string().regex(/^[a-f0-9]{8}$/),
};

export const IeltsWritingCriterionEvidenceSchema = z.object({
  skill: z.literal("writing"),
  criterion: z.enum(WRITING_CRITERIA),
  ...commonEvidenceFields,
});
export const IeltsSpeakingCriterionEvidenceSchema = z.object({
  skill: z.literal("speaking"),
  criterion: z.enum(SPEAKING_CRITERIA),
  ...commonEvidenceFields,
});
export const IeltsCriterionEvidenceSchema = z.discriminatedUnion("skill", [
  IeltsWritingCriterionEvidenceSchema,
  IeltsSpeakingCriterionEvidenceSchema,
]);
export type IeltsCriterionEvidenceContract = z.infer<
  typeof IeltsCriterionEvidenceSchema
>;

type EvidenceContext = {
  stage: IeltsCriterionEvidenceStage;
  gradingVersion: string;
  traceId: string;
  runId: string;
  provider: string;
  model: string;
  rubricVersion?: string;
  promptVersion?: string;
  confidence?: number;
  workflowAttempt?: number;
  providerAttempt?: number;
  validatedOutputSnapshot: Json;
};

function stableJson(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key] ?? null)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Stable, dependency-free digest used to detect snapshot drift. */
export function deterministicEvidenceHash(value: Json): string {
  let hash = 2166136261;
  for (const character of stableJson(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function completeContext(context: EvidenceContext) {
  return {
    ...context,
    rubricVersion: context.rubricVersion ?? "ielts-rubric-v1",
    promptVersion: context.promptVersion ?? "ielts-prompt-v1",
    confidence: context.confidence ?? 0.5,
    workflowAttempt: context.workflowAttempt ?? 1,
    providerAttempt: context.providerAttempt ?? 1,
    deterministicHash: deterministicEvidenceHash(
      context.validatedOutputSnapshot,
    ),
  };
}

export function buildWritingCriterionEvidence(params: {
  score: NormalizedWritingScore;
  context: EvidenceContext;
}): IeltsCriterionEvidenceContract[] {
  return WRITING_CRITERIA.map((criterion: WritingCriterionKey) =>
    IeltsWritingCriterionEvidenceSchema.parse({
      skill: "writing",
      criterion,
      band: params.score.criteriaBands[criterion],
      rationale: params.score.rationales[criterion],
      ...completeContext(params.context),
    }),
  );
}

export function buildSpeakingCriterionEvidence(params: {
  score: NormalizedSpeakingScore;
  context: EvidenceContext;
}): IeltsCriterionEvidenceContract[] {
  return SPEAKING_CRITERIA.map((criterion: SpeakingCriterionKey) =>
    IeltsSpeakingCriterionEvidenceSchema.parse({
      skill: "speaking",
      criterion,
      band: params.score.criteriaBands[criterion],
      rationale: params.score.rationales[criterion],
      ...completeContext(params.context),
    }),
  );
}

type ScoringTrace = {
  traceId: string;
  providerLabel: string;
  modelName: string;
  output: unknown;
};

export function buildSpeakingRunCriterionEvidence(params: {
  provisionalScore: NormalizedSpeakingScore;
  finalScore: NormalizedSpeakingScore;
  provisional: ScoringTrace;
  final: ScoringTrace;
  adjudicatedVersion: string;
}): IeltsCriterionEvidenceContract[] {
  const evidence = buildSpeakingCriterionEvidence({
    score: params.provisionalScore,
    context: {
      stage: "provisional",
      gradingVersion: IELTS_PROVISIONAL_EVIDENCE_VERSION,
      traceId: params.provisional.traceId,
      runId: params.provisional.traceId,
      provider: params.provisional.providerLabel,
      model: params.provisional.modelName,
      rubricVersion: "ielts-speaking-rubric-v1",
      promptVersion: "ielts_speaking_scorer@1",
      confidence: 0.5,
      validatedOutputSnapshot: params.provisional.output as Json,
    },
  });
  if (params.final.traceId === params.provisional.traceId) return evidence;
  evidence.push(
    ...buildSpeakingCriterionEvidence({
      score: params.finalScore,
      context: {
        stage: "adjudicated",
        gradingVersion: params.adjudicatedVersion,
        traceId: params.final.traceId,
        runId: params.provisional.traceId,
        provider: params.final.providerLabel,
        model: params.final.modelName,
        rubricVersion: "ielts-speaking-rubric-v1",
        promptVersion: "ielts_speaking_adjudication@1",
        confidence: 0.7,
        validatedOutputSnapshot: params.final.output as Json,
      },
    }),
  );
  return evidence;
}
