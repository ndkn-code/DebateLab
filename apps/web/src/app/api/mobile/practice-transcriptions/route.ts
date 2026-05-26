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
  isMobilePracticeAudioPathForUser,
  MOBILE_PRACTICE_AUDIO_BUCKET,
  MOBILE_PRACTICE_AUDIO_MIME_TYPES,
  type PracticeLanguage,
  type PracticeTranscriptionArtifact,
} from "@thinkfy/shared/practice";
import { transcribePracticeAudio } from "@/lib/stt/transcription";
import { parseMotionBriefForStt } from "@/lib/stt/request";
import type { MotionBrief } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 26_214_400;
const ALLOWED_MIME_TYPES = new Set<string>(MOBILE_PRACTICE_AUDIO_MIME_TYPES);
const STORAGE_DOWNLOAD_TIMEOUT_MS = 15_000;

type TranscriptionRequest = {
  bucket: typeof MOBILE_PRACTICE_AUDIO_BUCKET;
  path: string;
  contentType: string;
  byteSize: number;
  durationSeconds: number;
  practiceLanguage: PracticeLanguage;
  recordingId: string | undefined;
  topic: string | undefined;
  side: "proposition" | "opposition" | undefined;
  motionBrief: MotionBrief | undefined;
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
    topic: getString(body, "topic", { maxLength: 300 }),
    side: getEnum(body, "side", ["proposition", "opposition"] as const),
    motionBrief: parseMotionBriefForStt(body.motionBrief),
  };
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

  const audioBuffer = await audioBlob.arrayBuffer();
  const transcription: PracticeTranscriptionArtifact =
    await transcribePracticeAudio({
      audioBuffer,
      contentType: input.contentType,
      practiceLanguage: input.practiceLanguage,
      audioBucket: input.bucket,
      audioStoragePath: input.path,
      durationSeconds: input.durationSeconds,
      topic: input.topic,
      side: input.side,
      motionBrief: input.motionBrief,
    });

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
