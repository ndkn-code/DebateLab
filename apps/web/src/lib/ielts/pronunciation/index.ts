/**
 * Public surface of the IELTS phoneme-level pronunciation integration (WS-3.3).
 *
 * The Speaking scorer (WS-3.2) imports from here:
 *  - {@link assessPronunciation} — audio + reference text → typed phoneme report
 *    + suggested 0–9 Pronunciation band (env-gated, never throws).
 *  - {@link parsePhonemeReport} / {@link phonemeReportSchema} — validate the
 *    `speaking_responses.phoneme_report` jsonb on read/write.
 *  - {@link derivePronunciationBand} — blend the objective band into its rubric.
 */
export {
  assessPronunciation,
  type AssessPronunciationInput,
  type AssessPronunciationOutcome,
  type AssessPronunciationDeps,
  type SkipReason,
} from "./service";
export {
  azureSpeechEnvSchema,
  getAzureSpeechConfig,
  isAzurePronunciationConfigured,
  validateAzureSpeechEnv,
  type AzureSpeechEnv,
  type AzureSpeechEnvValidation,
  type AzureSpeechConfig,
} from "./config";
export {
  AZURE_PRONUNCIATION_WAV_CONTENT_TYPE,
  azurePronunciationContentType,
} from "./audio-format";
export {
  AZURE_PRONUNCIATION_MODEL,
  AZURE_PRONUNCIATION_PROVIDER,
  DEFAULT_PRONUNCIATION_LOCALE,
  SUPPORTED_PRONUNCIATION_LOCALES,
  type SupportedPronunciationLocale,
} from "./constants";
export {
  EMPTY_PHONEME_REPORT,
  isScoredPhonemeReport,
  parsePhonemeReport,
  phonemeReportSchema,
  PRONUNCIATION_ERROR_TYPES,
  type OverallPronunciation,
  type PhonemeReport,
  type PhonemeScore,
  type PronunciationErrorType,
  type WordScore,
} from "@/lib/scoring/ielts-pronunciation/phoneme-report";
export { derivePronunciationBand } from "@/lib/scoring/ielts-pronunciation/pronunciation-band";
export {
  mapAzureAssessmentToReport,
  azurePronunciationResponseSchema,
  type AzureMappingOptions,
  type AzurePronunciationResponse,
} from "@/lib/scoring/ielts-pronunciation/azure-assessment";
