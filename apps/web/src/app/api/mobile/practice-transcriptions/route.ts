import { NextRequest, NextResponse } from "next/server";
import {
  getEnum,
  getNumber,
  getString,
  readJsonObject,
  RequestValidationError,
  type JsonRecord,
} from "@/lib/api/request-validation";
import {
  requireRequestAuth,
  shouldConsumeUserRateLimit,
} from "@/lib/api/request-auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  getPracticeLanguageConfig,
  isMobilePracticeAudioPathForUser,
  MOBILE_PRACTICE_AUDIO_BUCKET,
  MOBILE_PRACTICE_AUDIO_MIME_TYPES,
  type PracticeLanguage,
  type PracticeTranscriptionArtifact,
  type PracticeTranscriptionWarning,
} from "@thinkfy/shared/practice";

export const runtime = "nodejs";
export const maxDuration = 45;

const MAX_AUDIO_BYTES = 26_214_400;
const DEEPGRAM_MODEL = "nova-3";
const ALLOWED_MIME_TYPES = new Set<string>(MOBILE_PRACTICE_AUDIO_MIME_TYPES);
const STORAGE_DOWNLOAD_TIMEOUT_MS = 15_000;
const DEEPGRAM_TRANSCRIPTION_TIMEOUT_MS = 30_000;

type TranscriptionRequest = {
  bucket: typeof MOBILE_PRACTICE_AUDIO_BUCKET;
  path: string;
  contentType: string;
  byteSize: number;
  durationSeconds: number;
  practiceLanguage: PracticeLanguage;
  recordingId: string | undefined;
};

type DeepgramResponse = {
  metadata?: {
    request_id?: string;
  };
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
        confidence?: number;
        words?: unknown[];
      }>;
    }>;
  };
};

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

function createRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `mobile-transcription-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function parseTranscriptionRequest(body: JsonRecord): TranscriptionRequest {
  const bucket = getString(body, "bucket", {
    required: true,
    maxLength: 80,
  });
  if (bucket !== MOBILE_PRACTICE_AUDIO_BUCKET) {
    throw new RequestValidationError("bucket is invalid.");
  }

  const contentType = getString(body, "contentType", {
    required: true,
    maxLength: 80,
  })!;
  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    throw new RequestValidationError("contentType is invalid.");
  }

  const byteSize = getNumber(body, "byteSize", {
    required: true,
    min: 1,
  })!;
  if (byteSize > MAX_AUDIO_BYTES) {
    throw new RequestValidationError("byteSize is too large.", 413);
  }

  return {
    bucket,
    path: getString(body, "path", {
      required: true,
      minLength: 8,
      maxLength: 600,
    })!,
    contentType,
    byteSize,
    durationSeconds: getNumber(body, "durationSeconds", {
      required: true,
      min: 1,
      max: 7200,
    })!,
    practiceLanguage: getEnum(body, "practiceLanguage", ["en", "vi"] as const, {
      defaultValue: "en",
    })!,
    recordingId: getString(body, "recordingId", { maxLength: 160 }),
  };
}

function parseJsonSafely<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function getStorageErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") return 500;
  const statusCode = "statusCode" in error ? Number(error.statusCode) : NaN;
  if (statusCode === 400 || statusCode === 404) return 404;
  if (Number.isFinite(statusCode)) return statusCode;
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";
  if (
    message.includes("not found") ||
    message.includes("does not exist") ||
    message.includes("resource")
  ) {
    return 404;
  }
  return 404;
}

function getWordCount(transcript: string) {
  return transcript.trim().split(/\s+/).filter(Boolean).length;
}

function buildDeepgramUrl(practiceLanguage: PracticeLanguage) {
  const language = getPracticeLanguageConfig(practiceLanguage);
  const url = new URL("https://api.deepgram.com/v1/listen");

  url.searchParams.set("model", DEEPGRAM_MODEL);
  url.searchParams.set("language", language.deepgramLanguage);
  url.searchParams.set("smart_format", "true");
  url.searchParams.set("utterances", "true");
  if (practiceLanguage === "en") {
    url.searchParams.set("filler_words", "true");
  }

  return url;
}

function buildWarnings(transcript: string, wordCount: number) {
  const warnings: PracticeTranscriptionWarning[] = [];
  if (!transcript) warnings.push("no_speech_detected");
  if (transcript && wordCount < 20) warnings.push("short_transcript");
  return warnings;
}

function readBearerTokenFromRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  const [scheme, token, ...rest] = authorization.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token || rest.length > 0) {
    return null;
  }
  return token;
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new TimeoutError(message)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function fetchBlobWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    const blob = await response.blob();
    return { response, blob };
  } catch (error) {
    if (
      error instanceof TimeoutError ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      throw new TimeoutError("Audio download timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchDeepgramWithTimeout(
  url: URL,
  init: RequestInit,
  timeoutMs: number,
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
    if (
      error instanceof TimeoutError ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      throw new TimeoutError("Speech recognition timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-debug-id") ?? createRequestId();
  const auth = await requireRequestAuth(request);

  if (!auth.ok) {
    return auth.errorResponse;
  }

  const { supabase, user } = auth;
  if (shouldConsumeUserRateLimit(auth)) {
    const rateLimit = await consumeRateLimit(supabase, {
      scope: "mobile-practice-transcription",
      limit: 10,
      windowSeconds: 600,
    });
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: "Too many transcription requests. Please wait a moment.",
          code: "rate_limited",
          requestId,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }
  }

  let input: TranscriptionRequest;
  try {
    input = parseTranscriptionRequest(
      await readJsonObject(request, { maxBytes: 8 * 1024 }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid transcription request.",
        code: "invalid_request",
        requestId,
      },
      { status: error instanceof RequestValidationError ? error.status : 400 },
    );
  }

  if (!isMobilePracticeAudioPathForUser(input.path, user.id)) {
    return NextResponse.json(
      {
        error: "Audio object does not belong to the authenticated user.",
        code: "forbidden_audio_path",
        requestId,
      },
      { status: 403 },
    );
  }

  let audioBlob: Blob | null = null;
  let downloadError: unknown = null;

  try {
    if (auth.authSource === "bearer") {
      const accessToken = readBearerTokenFromRequest(request);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!accessToken || !supabaseUrl || !supabaseAnonKey) {
        return NextResponse.json(
          {
            error: "Storage download is not configured.",
            code: "storage_download_not_configured",
            requestId,
          },
          { status: 500 },
        );
      }

      const storageUrl = `${supabaseUrl}/storage/v1/object/authenticated/${encodeURIComponent(
        input.bucket,
      )}/${encodeStoragePath(input.path)}`;
      const { response, blob } = await fetchBlobWithTimeout(
        storageUrl,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: supabaseAnonKey,
          },
          cache: "no-store",
        },
        STORAGE_DOWNLOAD_TIMEOUT_MS,
      );

      if (!response.ok) {
        downloadError = { statusCode: response.status };
      } else {
        audioBlob = blob;
      }
    } else {
      const result = await withTimeout(
        supabase.storage.from(input.bucket).download(input.path),
        STORAGE_DOWNLOAD_TIMEOUT_MS,
        "Audio download timed out.",
      );
      audioBlob = result.data;
      downloadError = result.error;
    }
  } catch (error) {
    if (error instanceof TimeoutError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "audio_download_timeout",
          requestId,
        },
        { status: 504 },
      );
    }
    downloadError = error;
  }

  if (downloadError || !audioBlob) {
    const status = downloadError ? getStorageErrorStatus(downloadError) : 404;
    return NextResponse.json(
      {
        error:
          status === 404
            ? "Audio object was not found."
            : "Unable to read practice audio.",
        code: status === 404 ? "audio_not_found" : "audio_download_failed",
        requestId,
      },
      { status },
    );
  }

  if (audioBlob.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      {
        error: "Audio object is larger than the 25 MB transcription limit.",
        code: "audio_too_large",
        requestId,
      },
      { status: 413 },
    );
  }

  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramApiKey) {
    return NextResponse.json(
      {
        error: "Speech recognition service is not configured.",
        code: "deepgram_missing_api_key",
        requestId,
      },
      { status: 502 },
    );
  }

  const audioBuffer = await audioBlob.arrayBuffer();
  let deepgramResponse: Response;
  let responseText: string;
  try {
    const result = await fetchDeepgramWithTimeout(
      buildDeepgramUrl(input.practiceLanguage),
      {
        method: "POST",
        headers: {
          Authorization: `Token ${deepgramApiKey}`,
          "Content-Type": input.contentType,
        },
        body: audioBuffer,
        cache: "no-store",
      },
      DEEPGRAM_TRANSCRIPTION_TIMEOUT_MS,
    );
    deepgramResponse = result.response;
    responseText = result.body;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof TimeoutError
            ? error.message
            : "Speech recognition service is unavailable.",
        code:
          error instanceof TimeoutError
            ? "deepgram_transcription_timeout"
            : "deepgram_transcription_failed",
        requestId,
      },
      { status: 502 },
    );
  }

  if (!deepgramResponse.ok) {
    const parsed = parseJsonSafely<Record<string, unknown>>(responseText);
    return NextResponse.json(
      {
        error: "Speech recognition service is unavailable.",
        code:
          deepgramResponse.status === 401 || deepgramResponse.status === 403
            ? "deepgram_forbidden"
            : "deepgram_transcription_failed",
        requestId,
        deepgramError:
          typeof parsed?.err_msg === "string"
            ? parsed.err_msg
            : typeof parsed?.message === "string"
              ? parsed.message
              : undefined,
      },
      { status: 502 },
    );
  }

  const parsed = parseJsonSafely<DeepgramResponse>(responseText);
  const alternative = parsed?.results?.channels?.[0]?.alternatives?.[0];
  const transcript = (alternative?.transcript ?? "").trim();
  const confidence =
    typeof alternative?.confidence === "number"
      ? Math.max(0, Math.min(1, alternative.confidence))
      : null;
  const wordCount = getWordCount(transcript);
  const deepgramRequestId =
    parsed?.metadata?.request_id ??
    deepgramResponse.headers.get("dg-request-id") ??
    deepgramResponse.headers.get("x-request-id") ??
    null;

  const transcription: PracticeTranscriptionArtifact = {
    transcript,
    confidence,
    wordCount,
    provider: "deepgram",
    model: DEEPGRAM_MODEL,
    requestId: deepgramRequestId,
    language: input.practiceLanguage,
    warnings: buildWarnings(transcript, wordCount),
    audioBucket: input.bucket,
    audioStoragePath: input.path,
    durationSeconds: input.durationSeconds,
    transcribedAt: new Date().toISOString(),
  };

  return NextResponse.json({
    requestId,
    transcription,
    audio: {
      bucket: input.bucket,
      path: input.path,
      byteSize: audioBlob.size,
      contentType: input.contentType,
      durationSeconds: input.durationSeconds,
      recordingId: input.recordingId,
    },
  });
}
