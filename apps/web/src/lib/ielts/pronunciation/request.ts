/**
 * Pure builders for the Azure Speech pronunciation-assessment REST call (WS-3.3).
 *
 * Azure takes the assessment parameters as a base64-encoded JSON config in the
 * `Pronunciation-Assessment` header, the audio as the raw request body, and the
 * recognition locale as a query param. Kept pure so the wire format is unit-tested
 * without the network.
 */
import type { AzureSpeechConfig } from "./config";
import {
  AZURE_RESOURCE_STT_RECOGNIZE_PATH,
  AZURE_STT_RECOGNIZE_PATH,
  DEFAULT_PRONUNCIATION_LOCALE,
} from "./constants";

export interface PronunciationAssessmentParams {
  referenceText: string;
  locale?: string;
  /** Phoneme alphabet for per-phoneme symbols; IPA powers the color-coded view. */
  phonemeAlphabet?: "IPA" | "SAPI";
  enableProsody?: boolean;
}

/** Build the base64-encoded JSON for the `Pronunciation-Assessment` header. */
export function buildAssessmentConfigHeader(
  params: PronunciationAssessmentParams,
): string {
  const config = {
    ReferenceText: params.referenceText,
    GradingSystem: "HundredMark",
    Granularity: "Phoneme",
    Dimension: "Comprehensive",
    PhonemeAlphabet: params.phonemeAlphabet ?? "IPA",
    EnableProsodyAssessment: params.enableProsody ?? true,
  };
  return Buffer.from(JSON.stringify(config), "utf8").toString("base64");
}

export interface AzureRequestInput {
  config: AzureSpeechConfig;
  audio: ArrayBuffer | Uint8Array;
  /** e.g. `audio/wav; codecs=audio/pcm; samplerate=16000`. */
  audioContentType: string;
  params: PronunciationAssessmentParams;
}

export interface AzureRequest {
  url: string;
  headers: Record<string, string>;
  body: ArrayBuffer | Uint8Array;
}

function recognitionEndpoint(config: AzureSpeechConfig): string {
  if (config.endpoint) {
    const endpoint = config.endpoint.replace(/\/+$/, "");
    if (endpoint.endsWith(AZURE_RESOURCE_STT_RECOGNIZE_PATH)) return endpoint;
    if (endpoint.endsWith(AZURE_STT_RECOGNIZE_PATH)) return endpoint;
    return `${endpoint}${AZURE_RESOURCE_STT_RECOGNIZE_PATH}`;
  }
  if (!config.region) {
    throw new Error("Azure Speech config requires a region or endpoint.");
  }
  return `https://${config.region}.stt.speech.microsoft.com${AZURE_STT_RECOGNIZE_PATH}`;
}

/** Build the full Azure pronunciation-assessment request (URL + headers + body). */
export function buildAssessmentRequest(input: AzureRequestInput): AzureRequest {
  const locale = input.params.locale ?? DEFAULT_PRONUNCIATION_LOCALE;
  const url = new URL(recognitionEndpoint(input.config));
  url.searchParams.set("language", locale);
  url.searchParams.set("format", "detailed");
  return {
    url: url.toString(),
    headers: {
      "Ocp-Apim-Subscription-Key": input.config.apiKey,
      "Content-Type": input.audioContentType,
      Accept: "application/json",
      "Pronunciation-Assessment": buildAssessmentConfigHeader(input.params),
      "User-Agent": "Thinkfy",
    },
    body: input.audio,
  };
}
