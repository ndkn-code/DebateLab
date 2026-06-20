/**
 * Audio content-type normalization for Azure pronunciation assessment (WS-5.2).
 *
 * Azure's short-audio REST endpoint requires the WAV-PCM content type
 * `audio/wav; codecs=audio/pcm; samplerate=16000` (see `request.ts`, which is a
 * pure pass-through of the caller-supplied content type). The Speaking scorer
 * downloads the uploaded audio and infers a generic type (e.g. `audio/wav`); this
 * maps that to the exact header Azure expects so a real `phoneme_report` comes
 * back end-to-end. Non-WAV inputs pass through unchanged — Azure then declines
 * them gracefully (the assessment is env-gated + never required).
 */

/** The exact Content-Type Azure pronunciation assessment expects for WAV PCM. */
export const AZURE_PRONUNCIATION_WAV_CONTENT_TYPE =
  "audio/wav; codecs=audio/pcm; samplerate=16000";

/**
 * Map a downloaded audio content type to the one Azure pronunciation assessment
 * expects. WAV/PCM inputs become the canonical header; anything else is returned
 * verbatim (Azure will decline non-WAV audio, which the caller treats as a no-op).
 */
export function azurePronunciationContentType(sourceContentType: string): string {
  const normalized = sourceContentType.toLowerCase();
  if (normalized.includes("wav") || normalized.includes("pcm")) {
    return AZURE_PRONUNCIATION_WAV_CONTENT_TYPE;
  }
  return sourceContentType;
}
