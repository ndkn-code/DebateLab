import { recordAiProviderRequest, type AiProviderRequestInput } from "@/lib/ai/provider-requests";
import {
  synthesizeTtsVoice,
  TtsProviderRequestError,
  type TtsSynthesisRequestOptions,
} from "@/lib/tts-providers";
import {
  DEFAULT_VOICE_BY_LANGUAGE,
  getDefaultVoiceForLanguage,
  getVoiceById,
  getVoicesForLanguage,
  type TTSVoice,
} from "@/lib/tts-voices";
import type { PracticeLanguage } from "@/types";

const DEFAULT_TTS_TIMEOUT_MS = 18_000;
const DEFAULT_TTS_RETRIES = 1;
const DEFAULT_TTS_MAX_VOICES = 4;
const ERROR_CODE_PATTERN = /[A-Z][A-Z0-9_]{2,99}/;

type TtsProvider = TTSVoice["provider"];

export type TtsProviderAttemptStatus = "success" | "error";

export interface TtsProviderAttempt {
  provider: TtsProvider;
  voiceId: string;
  status: TtsProviderAttemptStatus;
  latencyMs: number;
  responseStatus?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  skipped?: boolean;
}

export interface TtsSynthesisResult {
  audioBuffer: ArrayBuffer;
  voice: TTSVoice;
  attempts: TtsProviderAttempt[];
  latencyMs: number;
  fallbackUsed: boolean;
}

export type TtsProviderEnvironment = Partial<Record<string, string | undefined>>;

export interface TtsSynthesisContext {
  textLength: number;
  language: PracticeLanguage;
  requestedVoiceId: string;
  selectedVoiceId?: string | null;
  fallbackUsed: boolean;
  userId?: string | null;
  attemptIndex: number;
}

export interface SynthesizeTtsWithFallbackOptions {
  env?: TtsProviderEnvironment;
  maxVoices?: number;
  retries?: number;
  timeoutMs?: number;
  synthesize?: (
    text: string,
    voice: TTSVoice,
    options?: TtsSynthesisRequestOptions
  ) => Promise<ArrayBuffer>;
  now?: () => number;
}

export class TtsSynthesisFailedError extends Error {
  readonly attempts: TtsProviderAttempt[];

  constructor(attempts: TtsProviderAttempt[]) {
    super("TTS_SYNTHESIS_FAILED");
    this.name = "TtsSynthesisFailedError";
    this.attempts = attempts;
  }
}

function dedupeVoices(voices: Array<TTSVoice | null | undefined>) {
  const seen = new Set<string>();
  return voices.filter((voice): voice is TTSVoice => {
    if (!voice || seen.has(voice.id)) return false;
    seen.add(voice.id);
    return true;
  });
}

function findSameLanguageVoice(
  requestedVoice: TTSVoice,
  predicate: (voice: TTSVoice) => boolean
) {
  return getVoicesForLanguage(requestedVoice.language).find(
    (voice) => voice.id !== requestedVoice.id && predicate(voice)
  );
}

function findVietnameseFallbackVoice(requestedVoice: TTSVoice) {
  const fallbackProvider = requestedVoice.provider === "google" ? "azure" : "google";
  return findSameLanguageVoice(
    requestedVoice,
    (voice) =>
      voice.provider === fallbackProvider &&
      voice.gender === requestedVoice.gender &&
      voice.quality === "high"
  );
}

function findSameProviderAlternateVoice(requestedVoice: TTSVoice) {
  return findSameLanguageVoice(
    requestedVoice,
    (voice) =>
      voice.provider === requestedVoice.provider &&
      voice.gender === requestedVoice.gender &&
      (voice.quality === requestedVoice.quality || !requestedVoice.quality)
  );
}

export function buildTtsVoiceFallbackList(
  requestedVoice: TTSVoice,
  maxVoices = DEFAULT_TTS_MAX_VOICES
) {
  const defaultVoice = getVoiceById(
    DEFAULT_VOICE_BY_LANGUAGE[requestedVoice.language] ??
      getDefaultVoiceForLanguage(requestedVoice.language)
  );
  const sameLanguageHighQuality = getVoicesForLanguage(requestedVoice.language).filter(
    (voice) => voice.id !== requestedVoice.id && voice.quality === "high"
  );

  const candidates =
    requestedVoice.language === "vi"
      ? dedupeVoices([
          requestedVoice,
          findVietnameseFallbackVoice(requestedVoice),
          findSameProviderAlternateVoice(requestedVoice),
          defaultVoice,
          ...sameLanguageHighQuality,
          ...getVoicesForLanguage(requestedVoice.language),
        ])
      : dedupeVoices([
          requestedVoice,
          findSameProviderAlternateVoice(requestedVoice),
          defaultVoice,
          ...getVoicesForLanguage(requestedVoice.language),
        ]);

  return candidates.slice(0, Math.max(1, maxVoices));
}

export function getTtsProviderAvailability(
  env: TtsProviderEnvironment = process.env
): Record<TtsProvider, boolean> {
  return {
    deepgram: Boolean(env.DEEPGRAM_API_KEY),
    azure: Boolean(env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION),
    google: Boolean(
      env.GOOGLE_TTS_SERVICE_ACCOUNT_JSON || env.GOOGLE_APPLICATION_CREDENTIALS
    ),
  };
}

export function sanitizeTtsErrorCode(error: unknown, fallback = "TTS_PROVIDER_ERROR") {
  if (error instanceof TtsProviderRequestError) {
    return error.providerErrorCode;
  }

  const raw =
    error instanceof Error
      ? `${error.name || ""} ${error.message || ""}`
      : String(error ?? "");
  const match = raw.match(ERROR_CODE_PATTERN);
  return match?.[0] ?? fallback;
}

export function sanitizeTtsErrorMessage(error: unknown) {
  const code = sanitizeTtsErrorCode(error);
  if (code !== "TTS_PROVIDER_ERROR") return code;
  if (error instanceof DOMException && error.name === "AbortError") {
    return "TTS_PROVIDER_TIMEOUT";
  }
  if (error instanceof Error && error.name) return error.name.slice(0, 100);
  return "TTS provider request failed";
}

function getResponseStatus(error: unknown) {
  if (error instanceof TtsProviderRequestError) {
    return error.responseStatus;
  }
  return null;
}

function isRetryableTtsError(error: unknown) {
  if (error instanceof TtsProviderRequestError) {
    if (error.responseStatus === null) return false;
    return error.responseStatus === 408 || error.responseStatus === 429 || error.responseStatus >= 500;
  }

  const code = sanitizeTtsErrorCode(error);
  return (
    code === "TTS_PROVIDER_TIMEOUT" ||
    code === "AbortError" ||
    code === "TTS_PROVIDER_ERROR"
  );
}

async function synthesizeWithTimeout(
  text: string,
  voice: TTSVoice,
  timeoutMs: number,
  synthesize: NonNullable<SynthesizeTtsWithFallbackOptions["synthesize"]>
) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error("TTS_PROVIDER_TIMEOUT"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      synthesize(text, voice, { signal: controller.signal }),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function createUnavailableAttempt(voice: TTSVoice): TtsProviderAttempt {
  return {
    provider: voice.provider,
    voiceId: voice.id,
    status: "error",
    latencyMs: 0,
    responseStatus: null,
    errorCode: "PROVIDER_UNAVAILABLE",
    errorMessage: `${voice.provider}_tts_unconfigured`,
    skipped: true,
  };
}

export async function synthesizeTtsWithFallback(
  text: string,
  requestedVoice: TTSVoice,
  options: SynthesizeTtsWithFallbackOptions = {}
): Promise<TtsSynthesisResult> {
  const startedAt = options.now?.() ?? Date.now();
  const attempts: TtsProviderAttempt[] = [];
  const availability = getTtsProviderAvailability(options.env ?? process.env);
  const synthesize = options.synthesize ?? synthesizeTtsVoice;
  const maxVoices = options.maxVoices ?? DEFAULT_TTS_MAX_VOICES;
  const retries = Math.max(0, options.retries ?? DEFAULT_TTS_RETRIES);
  const timeoutMs = Math.max(1000, options.timeoutMs ?? DEFAULT_TTS_TIMEOUT_MS);
  const fallbackList = buildTtsVoiceFallbackList(requestedVoice, maxVoices);

  for (const voice of fallbackList) {
    if (!availability[voice.provider]) {
      attempts.push(createUnavailableAttempt(voice));
      continue;
    }

    for (let attemptNumber = 0; attemptNumber <= retries; attemptNumber += 1) {
      const attemptStartedAt = options.now?.() ?? Date.now();
      try {
        const audioBuffer = await synthesizeWithTimeout(
          text,
          voice,
          timeoutMs,
          synthesize
        );
        const endedAt = options.now?.() ?? Date.now();
        attempts.push({
          provider: voice.provider,
          voiceId: voice.id,
          status: "success",
          latencyMs: Math.max(0, endedAt - attemptStartedAt),
          responseStatus: 200,
        });

        return {
          audioBuffer,
          voice,
          attempts,
          latencyMs: Math.max(0, endedAt - startedAt),
          fallbackUsed: voice.id !== requestedVoice.id,
        };
      } catch (error) {
        const endedAt = options.now?.() ?? Date.now();
        attempts.push({
          provider: voice.provider,
          voiceId: voice.id,
          status: "error",
          latencyMs: Math.max(0, endedAt - attemptStartedAt),
          responseStatus: getResponseStatus(error),
          errorCode: sanitizeTtsErrorCode(error),
          errorMessage: sanitizeTtsErrorMessage(error),
        });

        if (attemptNumber >= retries || !isRetryableTtsError(error)) {
          break;
        }
      }
    }
  }

  throw new TtsSynthesisFailedError(attempts);
}

export function buildTtsTelemetryPayload(
  attempt: TtsProviderAttempt,
  context: TtsSynthesisContext
): AiProviderRequestInput {
  return {
    provider: `${attempt.provider}_tts`,
    model: attempt.voiceId,
    status: attempt.status,
    sourceRoute: "/api/tts",
    outputType: null,
    userId: context.userId ?? null,
    responseStatus: attempt.responseStatus ?? null,
    latencyMs: attempt.latencyMs,
    errorCode: attempt.errorCode ?? null,
    errorMessage: attempt.errorMessage ?? null,
    metadata: {
      language: context.language,
      requested_voice: context.requestedVoiceId,
      selected_voice: context.selectedVoiceId ?? null,
      fallback_used: context.fallbackUsed,
      text_length: context.textLength,
      attempt_index: context.attemptIndex,
      skipped: attempt.skipped === true,
    },
  };
}

export async function recordTtsProviderAttempts(
  attempts: TtsProviderAttempt[],
  context: Omit<TtsSynthesisContext, "attemptIndex">
) {
  const settled = await Promise.allSettled(
    attempts.map((attempt, attemptIndex) =>
      recordAiProviderRequest(
        buildTtsTelemetryPayload(attempt, { ...context, attemptIndex })
      )
    )
  );

  if (process.env.NODE_ENV === "development") {
    for (const result of settled) {
      if (result.status === "rejected") {
        console.warn(
          "TTS provider telemetry skipped:",
          result.reason instanceof Error ? result.reason.message : result.reason
        );
      }
    }
  }
}
