/**
 * Pure mapping from Azure Speech "Pronunciation Assessment" output to the typed
 * {@link PhonemeReport}. Kept pure (no I/O) so the score-mapping meets the
 * scoring coverage bar; the network call lives in `lib/ielts/pronunciation`.
 *
 * Azure has returned two detailed-response shapes over time. Older responses
 * nest scores under `PronunciationAssessment`; current responses can put the
 * same scores directly on `NBest[0]`, Word, and Phoneme objects. We accept both,
 * prefer the nested value when both are present, and clamp+round every score
 * into 0–100. The provider payload is untrusted, so it is parsed through a
 * tolerant Zod schema first.
 */
import { z } from "zod";
import {
  EMPTY_PHONEME_REPORT,
  phonemeReportSchema,
  type PhonemeReport,
} from "./phoneme-report";

const azureScores = z
  .object({
    AccuracyScore: z.number(),
    FluencyScore: z.number(),
    CompletenessScore: z.number(),
    PronScore: z.number(),
    ProsodyScore: z.number(),
  })
  .partial();

const azurePhonemeSchema = z
  .object({
    Phoneme: z.string(),
    AccuracyScore: z.number().optional(),
    PronunciationAssessment: z
      .object({ AccuracyScore: z.number() })
      .partial()
      .optional(),
  })
  .passthrough();

const azureWordSchema = z
  .object({
    Word: z.string(),
    AccuracyScore: z.number().optional(),
    ErrorType: z.string().optional(),
    PronunciationAssessment: z
      .object({ AccuracyScore: z.number(), ErrorType: z.string() })
      .partial()
      .optional(),
    Phonemes: z.array(azurePhonemeSchema).optional(),
  })
  .passthrough();

const azureNBestSchema = z
  .object({
    Display: z.string().optional(),
    Lexical: z.string().optional(),
    AccuracyScore: z.number().optional(),
    FluencyScore: z.number().optional(),
    CompletenessScore: z.number().optional(),
    PronScore: z.number().optional(),
    ProsodyScore: z.number().optional(),
    PronunciationAssessment: azureScores.optional(),
    Words: z.array(azureWordSchema).optional(),
  })
  .passthrough();

/** Tolerant schema for Azure's `format=detailed` pronunciation-assessment body. */
export const azurePronunciationResponseSchema = z
  .object({
    RecognitionStatus: z.string().optional(),
    DisplayText: z.string().optional(),
    NBest: z.array(azureNBestSchema).optional(),
  })
  .passthrough();

export type AzurePronunciationResponse = z.infer<
  typeof azurePronunciationResponseSchema
>;

export interface AzureMappingOptions {
  locale: string;
  provider: string;
  model: string;
  referenceText: string;
}

// The Zod schema admits only finite numbers (it rejects NaN/Infinity), so a
// value here is either a finite number or undefined (a missing optional field).
function clampScore(value: number | undefined): number {
  if (typeof value !== "number") return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function nullableScore(value: number | undefined): number | null {
  return typeof value === "number" ? clampScore(value) : null;
}

/**
 * Map an Azure pronunciation-assessment response (already JSON-parsed, untrusted)
 * to a typed {@link PhonemeReport}. Returns the EMPTY report when the response
 * carries no usable assessment (parse failure, RecognitionStatus != "Success",
 * or no overall scores) — phoneme detail augments the band, never required.
 */
export function mapAzureAssessmentToReport(
  raw: unknown,
  options: AzureMappingOptions,
): PhonemeReport {
  const parsed = azurePronunciationResponseSchema.safeParse(raw);
  if (!parsed.success) return EMPTY_PHONEME_REPORT;

  const response = parsed.data;
  const status = response.RecognitionStatus;
  if (status && status !== "Success") return EMPTY_PHONEME_REPORT;

  const nbest = response.NBest?.[0];
  if (!nbest) return EMPTY_PHONEME_REPORT;

  // Need overall scores to be useful; missing-everything payloads no-op.
  const nestedScores = nbest.PronunciationAssessment;
  const scores = {
    AccuracyScore: nestedScores?.AccuracyScore ?? nbest.AccuracyScore,
    FluencyScore: nestedScores?.FluencyScore ?? nbest.FluencyScore,
    CompletenessScore:
      nestedScores?.CompletenessScore ?? nbest.CompletenessScore,
    PronScore: nestedScores?.PronScore ?? nbest.PronScore,
    ProsodyScore: nestedScores?.ProsodyScore ?? nbest.ProsodyScore,
  };
  if (
    !Number.isFinite(scores.AccuracyScore) &&
    !Number.isFinite(scores.PronScore)
  ) {
    return EMPTY_PHONEME_REPORT;
  }

  const words = (nbest.Words ?? []).map((word) => ({
    word: word.Word,
    accuracy: clampScore(
      word.PronunciationAssessment?.AccuracyScore ?? word.AccuracyScore,
    ),
    errorType:
      word.PronunciationAssessment?.ErrorType ?? word.ErrorType ?? "None",
    phonemes: (word.Phonemes ?? []).map((phoneme) => ({
      phoneme: phoneme.Phoneme,
      accuracy: clampScore(
        phoneme.PronunciationAssessment?.AccuracyScore ?? phoneme.AccuracyScore,
      ),
    })),
  }));

  return phonemeReportSchema.parse({
    schemaVersion: 1,
    status: "scored",
    provider: options.provider,
    model: options.model,
    locale: options.locale,
    referenceText: options.referenceText,
    recognizedText: nbest.Display ?? response.DisplayText ?? "",
    overall: {
      accuracy: clampScore(scores.AccuracyScore),
      fluency: clampScore(scores.FluencyScore),
      completeness: clampScore(scores.CompletenessScore),
      prosody: nullableScore(scores.ProsodyScore),
      pronunciation: clampScore(scores.PronScore),
    },
    words,
  });
}
