export const GEMINI_LIVE_TRANSCRIPTION_MODEL =
  "gemini-3.5-transcribe-live" as const;
export const GEMINI_LIVE_TRANSCRIPTION_MODEL_RESOURCE =
  `models/${GEMINI_LIVE_TRANSCRIPTION_MODEL}` as const;
export const GEMINI_LIVE_TRANSCRIPTION_WEBSOCKET_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent" as const;
export const GEMINI_LIVE_TRANSCRIPTION_MIME_TYPE =
  "audio/pcm;rate=16000" as const;
export const GEMINI_LIVE_TRANSCRIPTION_PREROLL_MS = 300 as const;

export const GEMINI_LIVE_TRANSCRIPTION_AUDIO_REQUIREMENTS = {
  encoding: "pcm_s16le",
  sampleRateHz: 16_000,
  channels: 1,
  bitsPerSample: 16,
  littleEndian: true,
  mimeType: GEMINI_LIVE_TRANSCRIPTION_MIME_TYPE,
  minimumPrerollMs: GEMINI_LIVE_TRANSCRIPTION_PREROLL_MS,
} as const;

export interface GeminiLiveTranscriptionSetupMessage {
  setup: {
    model: typeof GEMINI_LIVE_TRANSCRIPTION_MODEL_RESOURCE;
    generationConfig: {
      responseModalities: readonly ["TEXT"];
    };
    inputAudioTranscription: {
      languageCodes: readonly [];
      mode: "VERBATIM";
    };
  };
}

export interface GeminiLiveRealtimeAudioMessage {
  realtimeInput: {
    audio: {
      data: string;
      mimeType: typeof GEMINI_LIVE_TRANSCRIPTION_MIME_TYPE;
    };
  };
}

export type GeminiLiveTranscriptionEvent =
  | { type: "setup_complete" }
  | { type: "interim"; text: string; languageCode: string | null }
  | { type: "final"; text: string; languageCode: string | null };

export function createGeminiLiveTranscriptionSetup(): GeminiLiveTranscriptionSetupMessage {
  return {
    setup: {
      model: GEMINI_LIVE_TRANSCRIPTION_MODEL_RESOURCE,
      generationConfig: { responseModalities: ["TEXT"] },
      inputAudioTranscription: {
        languageCodes: [],
        mode: "VERBATIM",
      },
    },
  };
}

export function createGeminiLivePcmAudioMessage(
  base64Pcm: string,
): GeminiLiveRealtimeAudioMessage {
  if (!base64Pcm) throw new Error("Gemini Live PCM payload is required");
  return {
    realtimeInput: {
      audio: {
        data: base64Pcm,
        mimeType: GEMINI_LIVE_TRANSCRIPTION_MIME_TYPE,
      },
    },
  };
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function transcriptionEvent(
  type: "interim" | "final",
  value: unknown,
): GeminiLiveTranscriptionEvent | null {
  const transcription = recordValue(value);
  if (!transcription || typeof transcription.text !== "string") return null;
  return {
    type,
    // VERBATIM means no trimming, punctuation, casing, or filler-word cleanup.
    text: transcription.text,
    languageCode:
      typeof transcription.languageCode === "string"
        ? transcription.languageCode
        : null,
  };
}

/**
 * Parses only setup/interim/final messages needed by the benchmark. Unknown
 * Live API messages are ignored and transcript text is preserved byte-for-byte.
 */
export function parseGeminiLiveTranscriptionServerMessage(
  input: unknown,
): GeminiLiveTranscriptionEvent[] {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch {
      return [];
    }
  }
  const message = recordValue(value);
  if (!message) return [];
  if (recordValue(message.setupComplete)) {
    return [{ type: "setup_complete" }];
  }
  const serverContent = recordValue(message.serverContent);
  if (!serverContent) return [];
  return [
    transcriptionEvent("interim", serverContent.interimInputTranscription),
    transcriptionEvent("final", serverContent.inputTranscription),
  ].filter((event): event is GeminiLiveTranscriptionEvent => event !== null);
}
