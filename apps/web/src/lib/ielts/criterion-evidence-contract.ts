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
};

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
      ...params.context,
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
      ...params.context,
    }),
  );
}
