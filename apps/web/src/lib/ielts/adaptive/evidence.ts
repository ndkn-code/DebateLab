import { z } from "zod";
import type { Json, TablesInsert } from "@/types/supabase";
import {
  IELTS_MODULES,
  IELTS_QUESTION_TYPES,
  IELTS_SKILLS,
  IELTS_TEST_KINDS,
} from "@/lib/api/ielts/schema";
import { roundToHalfBand } from "@/lib/scoring/round-half-band";

export const IELTS_ADAPTIVE_EVIDENCE_TYPES = [
  "mock_result",
  "section_result",
  "objective_response",
  "writing_score",
  "speaking_score",
  "phoneme_signal",
  "learn_activity",
  "review_result",
  "diagnostic_import",
  "manual_adjustment",
] as const;

export const IELTS_ADAPTIVE_SOURCE_TABLES = [
  "ielts_attempts",
  "ielts_attempt_sections",
  "ielts_question_responses",
  "attempt_band_scores",
  "writing_responses",
  "speaking_responses",
  "activity_attempts",
  "practice_attempts",
  "ielts_review_items",
  "manual_import",
] as const;

export type IeltsAdaptiveEvidenceType =
  (typeof IELTS_ADAPTIVE_EVIDENCE_TYPES)[number];

export const IeltsSubskillKeySchema = z
  .string()
  .min(3)
  .max(120)
  .regex(
    /^(listening|reading|writing|speaking):[a-z0-9_]+$/,
    "subskill key must look like reading:matching_headings",
  );

const HalfBandSchema = z
  .number()
  .min(0)
  .max(9)
  .refine((band) => Number.isInteger(band * 2), {
    message: "band must be a whole or half number",
  });

const AdaptiveTagSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9:_-]+$/, "tag must be lowercase snake/kebab key text");

const PostgresUuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "sourceId must be a PostgreSQL UUID",
  );

export const AdaptiveQuestionMetadataSchema = z
  .object({
    subskill_tags: z.array(IeltsSubskillKeySchema).max(16).optional(),
    difficulty_band_hint: HalfBandSchema.optional(),
    track_c_tags: z.array(AdaptiveTagSchema).max(24).optional(),
    learn_activity_weight: z.number().min(0).max(1).optional(),
  })
  .passthrough();

export type AdaptiveQuestionMetadata = z.infer<
  typeof AdaptiveQuestionMetadataSchema
>;

export function validateAdaptiveQuestionMetadata(
  metadata: Record<string, unknown>,
  ctx: z.RefinementCtx,
): void {
  const parsed = AdaptiveQuestionMetadataSchema.safeParse(metadata);
  if (parsed.success) return;
  for (const issue of parsed.error.issues) {
    ctx.addIssue({
      code: "custom",
      message: issue.message,
      path: ["metadata", ...issue.path],
    });
  }
}

export const IeltsAdaptiveEvidenceSchema = z
  .object({
    userId: z.string().uuid(),
    subskillKey: IeltsSubskillKeySchema,
    skill: z.enum(IELTS_SKILLS),
    module: z.enum(IELTS_MODULES).default("academic"),
    testKind: z.enum(IELTS_TEST_KINDS).nullish(),
    questionType: z.enum(IELTS_QUESTION_TYPES).nullish(),
    criterion: z.string().min(1).max(120).nullish(),
    evidenceType: z.enum(IELTS_ADAPTIVE_EVIDENCE_TYPES),
    evidenceValue: z.number().min(0).max(1),
    bandEstimate: HalfBandSchema.nullish(),
    rawScore: z.number().finite().nullish(),
    confidence: z.number().min(0).max(1),
    sourceTable: z.enum(IELTS_ADAPTIVE_SOURCE_TABLES),
    sourceId: PostgresUuidSchema,
    reasonEn: z.string().min(1).max(2000),
    reasonVi: z.string().min(1).max(2000),
    createdAt: z.string().datetime({ offset: true }),
  })
  .refine((value) => value.subskillKey.startsWith(`${value.skill}:`), {
    message: "subskillKey prefix must match skill",
    path: ["subskillKey"],
  });

export type IeltsAdaptiveEvidence = z.infer<
  typeof IeltsAdaptiveEvidenceSchema
>;

export interface DerivedIeltsSkillState {
  userId: string;
  subskillKey: string;
  skill: (typeof IELTS_SKILLS)[number];
  module: (typeof IELTS_MODULES)[number];
  questionType: (typeof IELTS_QUESTION_TYPES)[number] | null;
  criterion: string | null;
  masteryScore: number;
  bandEstimate: number | null;
  confidence: number;
  weaknessWeight: number;
  evidenceCount: number;
  lastEvidenceAt: string;
  explanation: {
    reasonEn: string;
    reasonVi: string;
    latestEvidenceType: IeltsAdaptiveEvidenceType;
    sources: Array<{
      table: (typeof IELTS_ADAPTIVE_SOURCE_TABLES)[number];
      id: string;
      occurredAt: string;
    }>;
    calculation: {
      masteryScore: number;
      confidence: number;
      weaknessWeight: number;
    };
  };
}

interface WorkingState extends DerivedIeltsSkillState {
  bandNumerator: number;
  bandDenominator: number;
  confidenceSum: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function roundDecimal(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function stateKey(evidence: IeltsAdaptiveEvidence): string {
  return `${evidence.userId}:${evidence.module}:${evidence.subskillKey}`;
}

function confidenceFor(count: number, averageEvidenceConfidence: number): number {
  return clamp01((1 - Math.exp(-count / 8)) * averageEvidenceConfidence);
}

function toWorkingState(evidence: IeltsAdaptiveEvidence): WorkingState {
  const band = evidence.bandEstimate ?? null;
  return {
    userId: evidence.userId,
    subskillKey: evidence.subskillKey,
    skill: evidence.skill,
    module: evidence.module,
    questionType: evidence.questionType ?? null,
    criterion: evidence.criterion ?? null,
    masteryScore: evidence.evidenceValue,
    bandEstimate: band,
    confidence: confidenceFor(1, evidence.confidence),
    weaknessWeight: 0,
    evidenceCount: 1,
    lastEvidenceAt: evidence.createdAt,
    explanation: explanationFor(evidence, evidence.evidenceValue, 0, 0),
    bandNumerator: band == null ? 0 : band * evidence.confidence,
    bandDenominator: band == null ? 0 : evidence.confidence,
    confidenceSum: evidence.confidence,
  };
}

function explanationFor(
  evidence: IeltsAdaptiveEvidence,
  masteryScore: number,
  confidence: number,
  weaknessWeight: number,
): DerivedIeltsSkillState["explanation"] {
  return {
    reasonEn: evidence.reasonEn,
    reasonVi: evidence.reasonVi,
    latestEvidenceType: evidence.evidenceType,
    sources: [
      {
        table: evidence.sourceTable,
        id: evidence.sourceId,
        occurredAt: evidence.createdAt,
      },
    ],
    calculation: {
      masteryScore: roundDecimal(masteryScore, 4),
      confidence: roundDecimal(confidence, 3),
      weaknessWeight: roundDecimal(weaknessWeight, 3),
    },
  };
}

function applyEvidence(
  current: WorkingState,
  evidence: IeltsAdaptiveEvidence,
): WorkingState {
  const evidenceCount = current.evidenceCount + 1;
  const masteryScore = clamp01(
    current.masteryScore * 0.72 + evidence.evidenceValue * 0.28,
  );
  const confidenceSum = current.confidenceSum + evidence.confidence;
  const confidence = confidenceFor(evidenceCount, confidenceSum / evidenceCount);
  const weaknessWeight = clamp01((1 - masteryScore) * confidence);
  const bandNumerator =
    evidence.bandEstimate == null
      ? current.bandNumerator
      : current.bandNumerator + evidence.bandEstimate * evidence.confidence;
  const bandDenominator =
    evidence.bandEstimate == null
      ? current.bandDenominator
      : current.bandDenominator + evidence.confidence;

  return {
    ...current,
    questionType: evidence.questionType ?? current.questionType,
    criterion: evidence.criterion ?? current.criterion,
    masteryScore,
    bandEstimate:
      bandDenominator === 0 ? null : roundToHalfBand(bandNumerator / bandDenominator),
    confidence,
    weaknessWeight,
    evidenceCount,
    lastEvidenceAt: evidence.createdAt,
    explanation: explanationFor(evidence, masteryScore, confidence, weaknessWeight),
    bandNumerator,
    bandDenominator,
    confidenceSum,
  };
}

function finalizeState(state: WorkingState): DerivedIeltsSkillState {
  return {
    userId: state.userId,
    subskillKey: state.subskillKey,
    skill: state.skill,
    module: state.module,
    questionType: state.questionType,
    criterion: state.criterion,
    masteryScore: roundDecimal(state.masteryScore, 4),
    bandEstimate: state.bandEstimate,
    confidence: roundDecimal(state.confidence, 3),
    weaknessWeight: roundDecimal(state.weaknessWeight, 3),
    evidenceCount: state.evidenceCount,
    lastEvidenceAt: state.lastEvidenceAt,
    explanation: state.explanation,
  };
}

export function deriveIeltsSkillStates(
  evidence: readonly IeltsAdaptiveEvidence[],
): DerivedIeltsSkillState[] {
  const sorted = [...evidence].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const states = new Map<string, WorkingState>();

  for (const item of sorted) {
    const key = stateKey(item);
    const existing = states.get(key);
    states.set(key, existing ? applyEvidence(existing, item) : toWorkingState(item));
  }

  return [...states.values()]
    .map(finalizeState)
    .sort((a, b) =>
      `${a.userId}:${a.module}:${a.subskillKey}`.localeCompare(
        `${b.userId}:${b.module}:${b.subskillKey}`,
      ),
    );
}

export function toIeltsSkillStateUpsert(
  state: DerivedIeltsSkillState,
  updatedAt: string = state.lastEvidenceAt,
): TablesInsert<"ielts_skill_states"> {
  return {
    user_id: state.userId,
    subskill_key: state.subskillKey,
    skill: state.skill,
    module: state.module,
    question_type: state.questionType,
    criterion: state.criterion,
    mastery_score: state.masteryScore,
    band_estimate: state.bandEstimate,
    confidence: state.confidence,
    weakness_weight: state.weaknessWeight,
    evidence_count: state.evidenceCount,
    last_evidence_at: state.lastEvidenceAt,
    explanation: state.explanation as Json,
    updated_at: updatedAt,
  };
}
