/**
 * Typed contract for `speaking_responses.phoneme_report` (WS-3.3).
 *
 * The column is jsonb (deeply-nested per-word / per-phoneme arrays) defaulting to
 * `'{}'`. This module is the single source of truth for its SHAPE: a Zod schema
 * with defaults so the bare `{}` default parses cleanly to an "empty" report,
 * plus the inferred types the Speaking scorer (WS-3.2) persists and the results
 * UI (WS-2.2) renders. The pronunciation SCORE itself stays in the typed
 * `pronunciation_band` numeric column — this report only AUGMENTS it.
 */
import { z } from "zod";

/** Azure pronunciation sub-scores are on a 0–100 scale (GradingSystem=HundredMark). */
const pronunciationScore = z.number().min(0).max(100);

/**
 * Azure word-level error categories (Comprehensive assessment). The stored shape
 * keeps `errorType` a free string to tolerate provider additions; these are the
 * known values for rendering (e.g. color-coding mispronounced words).
 */
export const PRONUNCIATION_ERROR_TYPES = [
  "None",
  "Mispronunciation",
  "Omission",
  "Insertion",
  "UnexpectedBreak",
  "MissingBreak",
  "Monotone",
] as const;
export type PronunciationErrorType = (typeof PRONUNCIATION_ERROR_TYPES)[number];

export const phonemeScoreSchema = z.object({
  /** IPA symbol (PhonemeAlphabet=IPA), e.g. "ɡ", "æ" — drives the per-sound view. */
  phoneme: z.string(),
  accuracy: pronunciationScore,
});
export type PhonemeScore = z.infer<typeof phonemeScoreSchema>;

export const wordScoreSchema = z.object({
  word: z.string(),
  accuracy: pronunciationScore,
  /** Known values in {@link PRONUNCIATION_ERROR_TYPES}; free-form for forward-compat. */
  errorType: z.string(),
  phonemes: z.array(phonemeScoreSchema),
});
export type WordScore = z.infer<typeof wordScoreSchema>;

export const overallPronunciationSchema = z.object({
  accuracy: pronunciationScore,
  fluency: pronunciationScore,
  completeness: pronunciationScore,
  /** Present only when prosody assessment is enabled AND returned by Azure. */
  prosody: pronunciationScore.nullable(),
  /** Azure's composite PronScore — the single best Pronunciation-criterion signal. */
  pronunciation: pronunciationScore,
});
export type OverallPronunciation = z.infer<typeof overallPronunciationSchema>;

/**
 * The full report. Every field has a default so `phonemeReportSchema.parse({})`
 * (the bare jsonb column default) yields a valid EMPTY report — reads never throw.
 */
export const phonemeReportSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  status: z.enum(["empty", "scored"]).default("empty"),
  provider: z.string().default(""),
  model: z.string().default(""),
  locale: z.string().default(""),
  referenceText: z.string().default(""),
  recognizedText: z.string().default(""),
  overall: overallPronunciationSchema.nullable().default(null),
  words: z.array(wordScoreSchema).default([]),
});
export type PhonemeReport = z.infer<typeof phonemeReportSchema>;

/** The empty/no-op report — also what the bare jsonb `{}` default parses to. */
export const EMPTY_PHONEME_REPORT: PhonemeReport = phonemeReportSchema.parse({});

/**
 * Validate arbitrary jsonb into a {@link PhonemeReport}, tolerating the `{}`
 * default and any malformed payload by falling back to the empty report. Phoneme
 * detail only augments the band, so a read must never throw on bad data.
 */
export function parsePhonemeReport(value: unknown): PhonemeReport {
  const result = phonemeReportSchema.safeParse(value);
  return result.success ? result.data : EMPTY_PHONEME_REPORT;
}

/** True when the report carries real assessment data (vs the empty default). */
export function isScoredPhonemeReport(report: PhonemeReport): boolean {
  return report.status === "scored" && report.overall !== null;
}
