/**
 * Structured-output contract for the IELTS Writing scorer (WS-3.1).
 *
 * The model is forced to return JSON matching this Zod schema, so the scorer is
 * transparent: per-criterion bands (0-9) WITH a rationale, inline correction
 * spans, paragraph feedback, a Band-9 model rewrite, and an optional
 * Vietnamese-language explanation. The numeric math (task band, Task-2-weighted
 * overall, half-band rounding) is computed deterministically from these
 * sub-scores in {@link ./band-math} — never taken as a black-box number.
 */
import { z } from "zod";

/** Category of an inline correction span. */
export const WRITING_ERROR_TYPES = [
  "grammar",
  "lexical",
  "cohesion",
  "spelling",
  "punctuation",
  "task",
] as const;

export type WritingErrorType = (typeof WRITING_ERROR_TYPES)[number];

const criterionScoreSchema = z.object({
  /** Raw band as judged by the model; snapped to a valid half-band downstream. */
  band: z.number().finite(),
  rationale: z.string().min(1).max(2000),
});

const inlineCorrectionSchema = z.object({
  original: z.string().min(1).max(600),
  suggestion: z.string().max(600),
  errorType: z.enum(WRITING_ERROR_TYPES),
  explanation: z.string().min(1).max(1200),
  /** 0-based index of the paragraph the span belongs to, when known. */
  paragraph: z.number().int().nonnegative().max(200).optional(),
});

const paragraphFeedbackSchema = z.object({
  paragraph: z.number().int().nonnegative().max(200),
  comment: z.string().min(1).max(2000),
  strengths: z.array(z.string().min(1).max(600)).max(10).optional(),
  improvements: z.array(z.string().min(1).max(600)).max(10).optional(),
});

export const ieltsWritingModelOutputSchema = z.object({
  criteria: z.object({
    taskResponse: criterionScoreSchema,
    coherenceCohesion: criterionScoreSchema,
    lexicalResource: criterionScoreSchema,
    grammaticalRangeAccuracy: criterionScoreSchema,
  }),
  overallSummary: z.string().min(1).max(4000),
  inlineCorrections: z.array(inlineCorrectionSchema).max(80).default([]),
  paragraphFeedback: z.array(paragraphFeedbackSchema).max(20).default([]),
  /** The Band-9 model rewrite of the candidate's essay. */
  modelAnswer: z.string().min(1).max(12000),
  /** Optional Vietnamese-language explanation (VN-first learners). */
  vietnameseSummary: z.string().min(1).max(4000).optional(),
});

export type IeltsWritingModelOutput = z.infer<typeof ieltsWritingModelOutputSchema>;
export type IeltsWritingCriterionScore = z.infer<typeof criterionScoreSchema>;
