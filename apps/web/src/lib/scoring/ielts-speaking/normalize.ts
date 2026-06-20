/**
 * Turn the model's validated structured output into the typed values we persist
 * for one Speaking response (WS-3.2). Pure + fully unit-tested (scoring coverage
 * gate): it snaps every criterion to a valid IELTS half-band, derives the
 * Speaking band from the official mean-of-4, and trims/normalizes the feedback
 * payloads that land in the `speaking_responses` typed columns + `feedback`
 * jsonb. Mirrors `scoring/ielts-writing/normalize.ts`.
 */
import {
  SPEAKING_CRITERIA,
  snapToHalfBand,
  speakingBandFromCriteria,
  type SpeakingCriteriaBands,
  type SpeakingCriterionKey,
} from "./band-math";
import type { IeltsSpeakingModelOutput } from "./result-schema";

export interface SpeakingExcerptFeedback {
  /** Verbatim transcript span where marks were lost. */
  excerpt: string;
  /** Which criterion this excerpt affects. */
  criterion: SpeakingCriterionKey;
  issue: string;
  suggestion: string;
}

export interface NormalizedSpeakingScore {
  /** Snapped per-criterion bands (each a valid 0-9 half-band). */
  criteriaBands: SpeakingCriteriaBands;
  /** Per-criterion examiner rationale (transparency: why this band). */
  rationales: Record<SpeakingCriterionKey, string>;
  /** Speaking band = mean of the four criteria, half-band rounded. */
  speakingBand: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  excerptFeedback: SpeakingExcerptFeedback[];
  vietnameseSummary: string | null;
}

export function normalizeSpeakingScore(
  raw: IeltsSpeakingModelOutput,
): NormalizedSpeakingScore {
  const criteriaBands = {} as SpeakingCriteriaBands;
  const rationales = {} as Record<SpeakingCriterionKey, string>;
  for (const key of SPEAKING_CRITERIA) {
    criteriaBands[key] = snapToHalfBand(raw.criteria[key].band);
    rationales[key] = raw.criteria[key].rationale.trim();
  }

  const excerptFeedback: SpeakingExcerptFeedback[] = raw.excerptFeedback.map(
    (entry) => ({
      excerpt: entry.excerpt.trim(),
      criterion: entry.criterion,
      issue: entry.issue.trim(),
      suggestion: entry.suggestion.trim(),
    }),
  );

  const vietnameseSummary = raw.vietnameseSummary?.trim();

  return {
    criteriaBands,
    rationales,
    speakingBand: speakingBandFromCriteria(criteriaBands),
    summary: raw.overallSummary.trim(),
    strengths: raw.strengths.map((item) => item.trim()),
    improvements: raw.improvements.map((item) => item.trim()),
    excerptFeedback,
    vietnameseSummary: vietnameseSummary ? vietnameseSummary : null,
  };
}

/** The transparency envelope persisted to `speaking_responses.feedback`. */
export interface SpeakingFeedback {
  summary: string;
  vietnameseSummary: string | null;
  strengths: string[];
  improvements: string[];
  excerpts: SpeakingExcerptFeedback[];
  criteria: Record<SpeakingCriterionKey, { band: number; rationale: string }>;
}

/**
 * Shape the per-criterion bands + rationales + summary + Vietnamese explanation
 * + excerpt feedback into the jsonb envelope (the numeric bands also live in
 * their typed columns; this carries the *why* + the exact lines where marks were
 * lost, so the report is never a black-box number).
 */
export function buildSpeakingFeedback(
  score: NormalizedSpeakingScore,
): SpeakingFeedback {
  const criteria = {} as Record<
    SpeakingCriterionKey,
    { band: number; rationale: string }
  >;
  for (const key of SPEAKING_CRITERIA) {
    criteria[key] = {
      band: score.criteriaBands[key],
      rationale: score.rationales[key],
    };
  }
  return {
    summary: score.summary,
    vietnameseSummary: score.vietnameseSummary,
    strengths: score.strengths,
    improvements: score.improvements,
    excerpts: score.excerptFeedback,
    criteria,
  };
}
