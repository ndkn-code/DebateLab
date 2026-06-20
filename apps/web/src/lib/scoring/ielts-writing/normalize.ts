/**
 * Turn the model's validated structured output into the typed values we persist
 * for one Writing task (WS-3.1). Pure + fully unit-tested (scoring coverage
 * gate): it snaps every criterion to a valid IELTS half-band, derives the task
 * band from the official mean, and trims/normalizes the feedback payloads that
 * land in the `writing_responses` typed + jsonb columns.
 */
import {
  WRITING_CRITERIA,
  snapToHalfBand,
  taskBandFromCriteria,
  type WritingCriteriaBands,
  type WritingCriterionKey,
} from "./band-math";
import type {
  IeltsWritingModelOutput,
  WritingErrorType,
} from "./result-schema";

export interface WritingInlineCorrection {
  original: string;
  suggestion: string;
  errorType: WritingErrorType;
  explanation: string;
  /** 0-based paragraph index, or null when the model didn't localize it. */
  paragraph: number | null;
}

export interface WritingParagraphFeedback {
  paragraph: number;
  comment: string;
  strengths: string[];
  improvements: string[];
}

export interface NormalizedWritingScore {
  /** Snapped per-criterion bands (each a valid 0-9 half-band). */
  criteriaBands: WritingCriteriaBands;
  /** Per-criterion examiner rationale (transparency: why this band). */
  rationales: Record<WritingCriterionKey, string>;
  /** Task band = mean of the four criteria, half-band rounded. */
  taskBand: number;
  summary: string;
  inlineCorrections: WritingInlineCorrection[];
  paragraphFeedback: WritingParagraphFeedback[];
  modelAnswer: string;
  vietnameseSummary: string | null;
}

export function normalizeWritingScore(
  raw: IeltsWritingModelOutput,
): NormalizedWritingScore {
  const criteriaBands = {} as WritingCriteriaBands;
  const rationales = {} as Record<WritingCriterionKey, string>;
  for (const key of WRITING_CRITERIA) {
    criteriaBands[key] = snapToHalfBand(raw.criteria[key].band);
    rationales[key] = raw.criteria[key].rationale.trim();
  }

  const inlineCorrections: WritingInlineCorrection[] = raw.inlineCorrections.map(
    (correction) => ({
      original: correction.original.trim(),
      suggestion: correction.suggestion.trim(),
      errorType: correction.errorType,
      explanation: correction.explanation.trim(),
      paragraph: correction.paragraph ?? null,
    }),
  );

  const paragraphFeedback: WritingParagraphFeedback[] =
    raw.paragraphFeedback.map((feedback) => ({
      paragraph: feedback.paragraph,
      comment: feedback.comment.trim(),
      strengths: (feedback.strengths ?? []).map((item) => item.trim()),
      improvements: (feedback.improvements ?? []).map((item) => item.trim()),
    }));

  const vietnameseSummary = raw.vietnameseSummary?.trim();

  return {
    criteriaBands,
    rationales,
    taskBand: taskBandFromCriteria(criteriaBands),
    summary: raw.overallSummary.trim(),
    inlineCorrections,
    paragraphFeedback,
    modelAnswer: raw.modelAnswer.trim(),
    vietnameseSummary: vietnameseSummary ? vietnameseSummary : null,
  };
}

/** The transparency envelope persisted to `writing_responses.criteria_feedback`. */
export interface WritingCriteriaFeedback {
  summary: string;
  vietnameseSummary: string | null;
  criteria: Record<WritingCriterionKey, { band: number; rationale: string }>;
}

/**
 * Shape the per-criterion bands + rationales + summary + Vietnamese explanation
 * into the jsonb envelope (the numeric bands also live in their typed columns;
 * this carries the *why*, so the report is never a black-box number).
 */
export function buildCriteriaFeedback(
  score: NormalizedWritingScore,
): WritingCriteriaFeedback {
  const criteria = {} as Record<
    WritingCriterionKey,
    { band: number; rationale: string }
  >;
  for (const key of WRITING_CRITERIA) {
    criteria[key] = {
      band: score.criteriaBands[key],
      rationale: score.rationales[key],
    };
  }
  return {
    summary: score.summary,
    vietnameseSummary: score.vietnameseSummary,
    criteria,
  };
}
