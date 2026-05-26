import "server-only";

import type {
  PracticeTranscriptionAlternative,
  PracticeTranscriptionArtifact,
  PracticeTranscriptionWarning,
} from "@thinkfy/shared/practice";
import type { MotionBrief, PracticeLanguage } from "@/types";
import { getPracticeLanguageConfig } from "@/lib/practice-language";
import { STT_DEEPGRAM_MODEL, getSttConfig } from "./config";
import { analyzeGroqTranscriptQuality, getSttWordCount } from "./consensus";
import { appendDeepgramKeyterms, buildSttKeyterms } from "./keyterms";
import { mergeWarnings, normalizeTranscriptionText } from "./normalization";

type DeepgramResponse = {
  metadata?: {
    request_id?: string;
  };
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
        confidence?: number;
      }>;
    }>;
  };
};

type ProviderResult = {
  provider: "deepgram" | "groq";
  model: string;
  transcript: string;
  confidence: number | null;
  requestId: string | null;
  errorCode?: string;
};

export type TranscribePracticeAudioInput = {
  audioBuffer: ArrayBuffer;
  contentType: string;
  practiceLanguage: PracticeLanguage;
  audioBucket: "practice-audio";
  audioStoragePath: string;
  durationSeconds: number;
  topic?: string | null;
  side?: "proposition" | "opposition" | "random" | null;
  motionBrief?: MotionBrief | null;
  prepNotes?: string | null;
};

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

const groqUsageState = {
  date: "",
  seconds: 0,
};

function parseJsonSafely<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  url: URL | string,
  init: RequestInit,
  timeoutMs: number,
  timeoutMessage: string
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    const body = await response.text();
    return { response, body };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new TimeoutError(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function buildDeepgramSttUrl(input: {
  practiceLanguage: PracticeLanguage;
  keyterms?: string[];
}) {
  const language = getPracticeLanguageConfig(input.practiceLanguage);
  const url = new URL("https://api.deepgram.com/v1/listen");
  url.searchParams.set("model", STT_DEEPGRAM_MODEL);
  url.searchParams.set("language", language.deepgramLanguage);
  url.searchParams.set("smart_format", "true");
  url.searchParams.set("utterances", "true");
  if (input.practiceLanguage === "en") {
    url.searchParams.set("filler_words", "true");
  }
  if (input.keyterms?.length) {
    appendDeepgramKeyterms(url, input.keyterms);
  }
  return url;
}

async function transcribeWithDeepgram(
  input: TranscribePracticeAudioInput,
  keyterms: string[],
  timeoutMs: number
): Promise<ProviderResult> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return {
      provider: "deepgram",
      model: STT_DEEPGRAM_MODEL,
      transcript: "",
      confidence: null,
      requestId: null,
      errorCode: "deepgram_missing_api_key",
    };
  }

  try {
    const { response, body } = await fetchWithTimeout(
      buildDeepgramSttUrl({
        practiceLanguage: input.practiceLanguage,
        keyterms,
      }),
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": input.contentType,
        },
        body: input.audioBuffer,
        cache: "no-store",
      },
      timeoutMs,
      "Deepgram speech recognition timed out."
    );

    if (!response.ok) {
      return {
        provider: "deepgram",
        model: STT_DEEPGRAM_MODEL,
        transcript: "",
        confidence: null,
        requestId: response.headers.get("dg-request-id"),
        errorCode:
          response.status === 401 || response.status === 403
            ? "deepgram_forbidden"
            : "deepgram_failed",
      };
    }

    const parsed = parseJsonSafely<DeepgramResponse>(body);
    const alternative = parsed?.results?.channels?.[0]?.alternatives?.[0];
    return {
      provider: "deepgram",
      model: STT_DEEPGRAM_MODEL,
      transcript: (alternative?.transcript ?? "").trim(),
      confidence:
        typeof alternative?.confidence === "number"
          ? Math.max(0, Math.min(1, alternative.confidence))
          : null,
      requestId:
        parsed?.metadata?.request_id ??
        response.headers.get("dg-request-id") ??
        response.headers.get("x-request-id") ??
        null,
    };
  } catch (error) {
    return {
      provider: "deepgram",
      model: STT_DEEPGRAM_MODEL,
      transcript: "",
      confidence: null,
      requestId: null,
      errorCode:
        error instanceof TimeoutError
          ? "deepgram_timeout"
          : "deepgram_unavailable",
    };
  }
}

function shouldUseGroq(input: TranscribePracticeAudioInput) {
  const config = getSttConfig();
  if (!config.finalRetranscribeEnabled) return false;
  if (
    config.finalProvider !== "deepgram_groq_consensus" &&
    config.finalProvider !== "deepgram_groq_shadow"
  ) {
    return false;
  }
  if (!config.finalRetranscribeLanguages.includes(input.practiceLanguage)) {
    return false;
  }
  if (!process.env.GROQ_API_KEY) return false;
  if (input.durationSeconds <= 0) return true;

  const today = new Date().toISOString().slice(0, 10);
  if (groqUsageState.date !== today) {
    groqUsageState.date = today;
    groqUsageState.seconds = 0;
  }
  return (
    config.groqDailySoftLimitSeconds <= 0 ||
    groqUsageState.seconds + input.durationSeconds <=
      config.groqDailySoftLimitSeconds
  );
}

function buildGroqPrompt(keyterms: string[]) {
  const importantTerms = keyterms
    .filter((term) => /[A-Z]{2,}|[A-Z][a-z]+/.test(term))
    .slice(0, 28);
  if (!importantTerms.length) return null;
  return `Vietnamese debate speech. Preserve acronyms and proper nouns exactly when spoken: ${importantTerms.join(", ")}.`;
}

async function transcribeWithGroq(
  input: TranscribePracticeAudioInput,
  keyterms: string[],
  timeoutMs: number
): Promise<ProviderResult> {
  const apiKey = process.env.GROQ_API_KEY;
  const config = getSttConfig();
  if (!apiKey) {
    return {
      provider: "groq",
      model: config.groqModel,
      transcript: "",
      confidence: null,
      requestId: null,
      errorCode: "groq_missing_api_key",
    };
  }

  try {
    const form = new FormData();
    form.set("model", config.groqModel);
    form.set("response_format", "json");
    if (input.practiceLanguage === "vi") {
      form.set("language", "vi");
    }
    const prompt = buildGroqPrompt(keyterms);
    if (prompt) {
      form.set("prompt", prompt.slice(0, 900));
    }
    form.set(
      "file",
      new Blob([input.audioBuffer], {
        type: input.contentType || "audio/webm",
      }),
      input.contentType.includes("mp4") || input.contentType.includes("m4a")
        ? "speech.m4a"
        : "speech.webm"
    );

    const { response, body } = await fetchWithTimeout(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: form,
        cache: "no-store",
      },
      timeoutMs,
      "Groq speech recognition timed out."
    );

    if (!response.ok) {
      return {
        provider: "groq",
        model: config.groqModel,
        transcript: "",
        confidence: null,
        requestId: response.headers.get("x-request-id"),
        errorCode:
          response.status === 429
            ? "groq_rate_limited"
            : response.status === 401 || response.status === 403
              ? "groq_forbidden"
              : "groq_failed",
      };
    }

    const parsed = parseJsonSafely<{ text?: string }>(body);
    if (input.durationSeconds > 0) {
      groqUsageState.seconds += input.durationSeconds;
    }
    return {
      provider: "groq",
      model: config.groqModel,
      transcript: (parsed?.text ?? "").trim(),
      confidence: null,
      requestId: response.headers.get("x-request-id"),
    };
  } catch (error) {
    return {
      provider: "groq",
      model: config.groqModel,
      transcript: "",
      confidence: null,
      requestId: null,
      errorCode:
        error instanceof TimeoutError ? "groq_timeout" : "groq_unavailable",
    };
  }
}

function toAlternative(
  result: ProviderResult,
  selected: boolean,
  qualityFlags?: string[]
): PracticeTranscriptionAlternative {
  return {
    provider: result.provider,
    model: result.model,
    transcript: result.transcript,
    confidence: result.confidence,
    requestId: result.requestId,
    selected,
    errorCode: result.errorCode,
    qualityFlags,
  };
}

function buildBaseWarnings(result: ProviderResult) {
  const warnings: PracticeTranscriptionWarning[] = [];
  if (!result.transcript) warnings.push("no_speech_detected");
  if (result.transcript && getSttWordCount(result.transcript) < 20) {
    warnings.push("short_transcript");
  }
  if (result.confidence != null && result.confidence < 0.65) {
    warnings.push("low_confidence");
  }
  return warnings;
}

export async function transcribePracticeAudio(
  input: TranscribePracticeAudioInput
): Promise<PracticeTranscriptionArtifact> {
  const config = getSttConfig();
  const keyterms = config.keytermPromptingEnabled
    ? buildSttKeyterms({
        practiceLanguage: input.practiceLanguage,
        topic: input.topic,
        side: input.side,
        motionBrief: input.motionBrief,
        prepNotes: input.prepNotes,
      })
    : [];
  const deepgram = await transcribeWithDeepgram(
    input,
    keyterms,
    config.deepgramTimeoutMs
  );
  const groq = shouldUseGroq(input)
    ? await transcribeWithGroq(input, keyterms, config.groqTimeoutMs)
    : null;

  const groqQuality =
    groq && !groq.errorCode
      ? analyzeGroqTranscriptQuality(deepgram.transcript, groq.transcript)
      : null;
  const deepgramUsable = Boolean(deepgram.transcript && !deepgram.errorCode);
  const selected =
    !deepgramUsable && groq && !groq.errorCode && groqQuality?.plausible
      ? groq
      : deepgram;
  const rawTranscript = selected.transcript || deepgram.transcript || groq?.transcript || "";
  const normalization = config.normalizationEnabled
    ? normalizeTranscriptionText({
        transcript: rawTranscript,
        practiceLanguage: input.practiceLanguage,
        topic: input.topic,
        motionBrief: input.motionBrief,
        prepNotes: input.prepNotes,
      })
    : {
        normalizedTranscript: rawTranscript,
        normalizationHints: [],
        warnings: [] as PracticeTranscriptionWarning[],
        wordCount: getSttWordCount(rawTranscript),
      };
  const selectedTranscript = normalization.normalizedTranscript || rawTranscript;
  const groqRejected =
    Boolean(groq?.transcript && groqQuality && !groqQuality.plausible);
  const providerDisagreement = Boolean(
    deepgram.transcript && groq?.transcript && groqRejected
  );
  const warnings = mergeWarnings(
    buildBaseWarnings(selected),
    normalization.warnings,
    groq && groq.errorCode ? ["groq_unavailable"] : [],
    providerDisagreement ? ["provider_disagreement", "possible_stt_artifacts"] : [],
    selected.provider === "groq" ? ["fallback_transcript_used"] : []
  );

  const alternatives = [deepgram, groq]
    .filter((item): item is ProviderResult => Boolean(item))
    .map((item) =>
      toAlternative(
        item,
        item.provider === selected.provider,
        item.provider === "groq" ? groqQuality?.qualityFlags : undefined
      )
    );

  return {
    transcript: selectedTranscript,
    rawTranscript,
    normalizedTranscript:
      selectedTranscript !== rawTranscript ? selectedTranscript : undefined,
    confidence: selected.confidence,
    wordCount: normalization.wordCount,
    provider: groq ? "deepgram_groq_shadow" : selected.provider,
    model: groq
      ? `${STT_DEEPGRAM_MODEL}+${groq.model}`
      : selected.model,
    requestId: selected.requestId,
    language: input.practiceLanguage,
    warnings,
    alternatives,
    normalizationHints: normalization.normalizationHints,
    audioBucket: input.audioBucket,
    audioStoragePath: input.audioStoragePath,
    durationSeconds: input.durationSeconds,
    transcribedAt: new Date().toISOString(),
  };
}
