/**
 * Structured-output contract for the IELTS Speaking scorer (WS-3.2).
 *
 * The model is forced to return JSON matching this Zod schema, so the scorer is
 * transparent: per-criterion bands (0-9) WITH a rationale, the verbatim
 * transcript excerpts where marks were lost (the "exact lines" the brief calls
 * for), overall strengths/improvements, and an optional Vietnamese-language
 * explanation. The numeric math (Speaking band = mean of 4, half-band rounding)
 * is computed deterministically from these sub-scores in {@link ./band-math} —
 * never taken as a black-box number. Mirrors the Writing result schema.
 */
import { z } from "zod";
import { SPEAKING_CRITERIA } from "./band-math";

/** The criterion an excerpt of feedback is attributed to. */
export const SPEAKING_CRITERION_ENUM = z.enum(SPEAKING_CRITERIA);

const criterionScoreSchema = z.object({
  /** Raw band as judged by the model; snapped to a valid half-band downstream. */
  band: z.number().finite(),
  rationale: z.string().min(1).max(2000),
});

/** A verbatim transcript span tied to where a specific criterion lost marks. */
const excerptFeedbackSchema = z.object({
  excerpt: z.string().min(1).max(600),
  criterion: SPEAKING_CRITERION_ENUM,
  issue: z.string().min(1).max(1200),
  suggestion: z.string().max(1200),
});

function hasNonBlankExcerpt(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return true;
  }
  const excerpt = (value as { excerpt?: unknown }).excerpt;
  return typeof excerpt !== "string" || excerpt.trim().length > 0;
}

const excerptFeedbackArraySchema = z.preprocess(
  (value) =>
    Array.isArray(value) ? value.filter(hasNonBlankExcerpt) : value,
  z.array(excerptFeedbackSchema).max(60).default([]),
);

export const ieltsSpeakingModelOutputSchema = z.object({
  criteria: z.object({
    fluencyCoherence: criterionScoreSchema,
    lexicalResource: criterionScoreSchema,
    grammaticalRangeAccuracy: criterionScoreSchema,
    pronunciation: criterionScoreSchema,
  }),
  overallSummary: z.string().min(1).max(4000),
  /** Overall strengths (band-anchored, concrete). */
  strengths: z.array(z.string().min(1).max(600)).max(20).default([]),
  /** Overall improvement levers to reach the next band. */
  improvements: z.array(z.string().min(1).max(600)).max(20).default([]),
  /** Verbatim transcript excerpts where marks were lost, per criterion. */
  excerptFeedback: excerptFeedbackArraySchema,
  /** Optional Vietnamese-language explanation (VN-first learners). */
  vietnameseSummary: z.string().min(1).max(4000).optional(),
});

export type IeltsSpeakingModelOutput = z.infer<
  typeof ieltsSpeakingModelOutputSchema
>;
export type IeltsSpeakingCriterionScore = z.infer<typeof criterionScoreSchema>;
export type IeltsSpeakingExcerptFeedback = z.infer<typeof excerptFeedbackSchema>;
