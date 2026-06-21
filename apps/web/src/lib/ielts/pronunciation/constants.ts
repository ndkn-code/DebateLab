/**
 * Provider/protocol constants for the Azure Speech pronunciation integration
 * (WS-3.3). Centralised so the provider-call logging, the wire format, and the
 * cost dashboards all agree on the same labels.
 */

/** `ai_provider_requests.provider` — Azure Cognitive Services Speech. */
export const AZURE_PRONUNCIATION_PROVIDER = "azure";
/** `ai_provider_requests.model` — the pronunciation-assessment feature. */
export const AZURE_PRONUNCIATION_MODEL = "pronunciation-assessment";
/** `ai_provider_requests.source_route` — groups the call on cost dashboards. */
export const PRONUNCIATION_SOURCE_ROUTE = "ielts_speaking_pronunciation";
/** `ai_provider_requests.output_type` — what the call produces. */
export const PRONUNCIATION_OUTPUT_TYPE = "phoneme_report";

/** Default recognition locale; IELTS accepts UK/US/AUS (and other) English. */
export const DEFAULT_PRONUNCIATION_LOCALE = "en-US";
export const SUPPORTED_PRONUNCIATION_LOCALES = [
  "en-US",
  "en-GB",
  "en-AU",
  "en-CA",
  "en-IN",
] as const;
export type SupportedPronunciationLocale =
  (typeof SUPPORTED_PRONUNCIATION_LOCALES)[number];

/** Azure short-audio REST recognition path (mirrors the TTS host pattern). */
export const AZURE_STT_RECOGNIZE_PATH =
  "/speech/recognition/conversation/cognitiveservices/v1";

/** Resource endpoint path from current Azure docs (`*.cognitiveservices.azure.com`). */
export const AZURE_RESOURCE_STT_RECOGNIZE_PATH =
  `/stt${AZURE_STT_RECOGNIZE_PATH}`;
