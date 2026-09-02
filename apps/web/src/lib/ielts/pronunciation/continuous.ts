import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

import {
  combineAzureAssessmentReports,
  mapAzureAssessmentToReport,
} from "@/lib/scoring/ielts-pronunciation/azure-assessment";
import type { PhonemeReport } from "@/lib/scoring/ielts-pronunciation/phoneme-report";
import type { AzureSpeechConfig } from "./config";
import {
  AZURE_PRONUNCIATION_MODEL,
  AZURE_PRONUNCIATION_PROVIDER,
} from "./constants";

const PCM_SAMPLE_RATE = 16_000;
const PCM_BITS_PER_SAMPLE = 16;
const PCM_CHANNELS = 1;
const DEFAULT_TIMEOUT_MS = 180_000;

type WavPcm = {
  pcm: ArrayBuffer;
  durationSeconds: number;
};

function supportedPcmData(
  format: { code: number; channels: number; rate: number; bits: number } | null,
  data: Uint8Array | null,
): Uint8Array {
  if (!format || !data) throw new Error("PRONUNCIATION_WAV_MISSING_CHUNK");
  if (
    format.code !== 1 ||
    format.channels !== PCM_CHANNELS ||
    format.rate !== PCM_SAMPLE_RATE ||
    format.bits !== PCM_BITS_PER_SAMPLE
  ) {
    throw new Error("PRONUNCIATION_WAV_UNSUPPORTED_FORMAT");
  }
  return data;
}

function ascii(view: DataView, offset: number, length: number): string {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index));
  }
  return value;
}

/** Parse the exact mono PCM WAV format produced by the IELTS recorder. */
export function parsePronunciationWav(audio: ArrayBuffer | Uint8Array): WavPcm {
  const bytes =
    audio instanceof Uint8Array
      ? new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength)
      : new Uint8Array(audio);
  if (bytes.byteLength < 44) throw new Error("PRONUNCIATION_WAV_TOO_SHORT");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (ascii(view, 0, 4) !== "RIFF" || ascii(view, 8, 4) !== "WAVE") {
    throw new Error("PRONUNCIATION_WAV_INVALID_CONTAINER");
  }

  let offset = 12;
  let format: {
    code: number;
    channels: number;
    rate: number;
    bits: number;
  } | null = null;
  let data: Uint8Array | null = null;
  while (offset + 8 <= bytes.byteLength) {
    const chunk = ascii(view, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + size;
    if (end > bytes.byteLength) throw new Error("PRONUNCIATION_WAV_TRUNCATED");
    if (chunk === "fmt " && size >= 16) {
      format = {
        code: view.getUint16(start, true),
        channels: view.getUint16(start + 2, true),
        rate: view.getUint32(start + 4, true),
        bits: view.getUint16(start + 14, true),
      };
    } else if (chunk === "data") {
      data = bytes.slice(start, end);
    }
    offset = end + (size % 2);
  }
  const pcmData = supportedPcmData(format, data);
  const pcm = new Uint8Array(pcmData.byteLength);
  pcm.set(pcmData);
  return {
    pcm: pcm.buffer,
    durationSeconds:
      pcmData.byteLength /
      (PCM_SAMPLE_RATE * PCM_CHANNELS * (PCM_BITS_PER_SAMPLE / 8)),
  };
}

function speechConfig(config: AzureSpeechConfig) {
  if (config.endpoint) {
    return SpeechSDK.SpeechConfig.fromEndpoint(
      new URL(config.endpoint),
      config.apiKey,
    );
  }
  if (!config.region) throw new Error("AZURE_SPEECH_REGION_MISSING");
  return SpeechSDK.SpeechConfig.fromSubscription(config.apiKey, config.region);
}

export interface ContinuousPronunciationInput {
  audio: ArrayBuffer | Uint8Array;
  config: AzureSpeechConfig;
  locale: string;
  timeoutMs?: number;
}

/**
 * Continuous, unscripted assessment for IELTS answers longer than Azure's
 * single-utterance REST window. No learner transcript is used as a reference:
 * that would turn spontaneous speaking into a misleading scripted assessment.
 */
export async function assessContinuousPronunciation(
  input: ContinuousPronunciationInput,
): Promise<PhonemeReport> {
  const wav = parsePronunciationWav(input.audio);
  const config = speechConfig(input.config);
  config.speechRecognitionLanguage = input.locale;
  config.outputFormat = SpeechSDK.OutputFormat.Detailed;

  const streamFormat = SpeechSDK.AudioStreamFormat.getWaveFormatPCM(
    PCM_SAMPLE_RATE,
    PCM_BITS_PER_SAMPLE,
    PCM_CHANNELS,
  );
  const pushStream = SpeechSDK.AudioInputStream.createPushStream(streamFormat);
  const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(pushStream);
  const recognizer = new SpeechSDK.SpeechRecognizer(config, audioConfig);
  const pronunciation = new SpeechSDK.PronunciationAssessmentConfig(
    "",
    SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
    SpeechSDK.PronunciationAssessmentGranularity.Phoneme,
    false,
  );
  pronunciation.phonemeAlphabet = "IPA";
  pronunciation.enableProsodyAssessment = true;
  pronunciation.applyTo(recognizer);

  const reports: PhonemeReport[] = [];
  const timeoutMs = Math.min(
    Math.max(input.timeoutMs ?? DEFAULT_TIMEOUT_MS, 10_000),
    DEFAULT_TIMEOUT_MS,
  );
  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let finishing = false;
      let stopWatchdog: ReturnType<typeof setTimeout> | undefined;
      const settle = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (stopWatchdog) clearTimeout(stopWatchdog);
        if (error) reject(error);
        else resolve();
      };
      const finish = (error?: Error) => {
        if (settled || finishing) return;
        finishing = true;
        clearTimeout(timeout);
        // The SDK has occasionally failed to invoke either stop callback after
        // a connection loss. Preserve the public timeout bound regardless.
        stopWatchdog = setTimeout(() => settle(error), 2_000);
        try {
          recognizer.stopContinuousRecognitionAsync(
            () => settle(error),
            (message) => settle(error ?? new Error(message)),
          );
        } catch (stopError) {
          settle(
            error ??
              (stopError instanceof Error
                ? stopError
                : new Error(String(stopError))),
          );
        }
      };
      const timeout = setTimeout(
        () => finish(new Error("AZURE_PRONUNCIATION_CONTINUOUS_TIMEOUT")),
        timeoutMs,
      );
      recognizer.recognized = (_sender, event) => {
        if (event.result.reason !== SpeechSDK.ResultReason.RecognizedSpeech)
          return;
        const raw = event.result.properties.getProperty(
          SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult,
        );
        if (!raw) return;
        try {
          const report = mapAzureAssessmentToReport(JSON.parse(raw), {
            locale: input.locale,
            provider: AZURE_PRONUNCIATION_PROVIDER,
            model: AZURE_PRONUNCIATION_MODEL,
            referenceText: "",
          });
          if (report.status === "scored") reports.push(report);
        } catch {
          // One malformed segment must not erase other valid segments.
        }
      };
      recognizer.canceled = (_sender, event) => {
        if (event.reason === SpeechSDK.CancellationReason.EndOfStream) finish();
        else
          finish(
            new Error(
              `AZURE_PRONUNCIATION_CONTINUOUS_CANCELED:${event.errorCode}:${event.errorDetails}`,
            ),
          );
      };
      recognizer.sessionStopped = () => finish();
      recognizer.startContinuousRecognitionAsync(
        () => {
          pushStream.write(wav.pcm);
          pushStream.close();
        },
        (message) => finish(new Error(message)),
      );
    });
  } finally {
    recognizer.close();
    audioConfig.close();
    pushStream.close();
  }
  return combineAzureAssessmentReports(reports, {
    locale: input.locale,
    provider: AZURE_PRONUNCIATION_PROVIDER,
    model: AZURE_PRONUNCIATION_MODEL,
    referenceText: "",
  });
}
