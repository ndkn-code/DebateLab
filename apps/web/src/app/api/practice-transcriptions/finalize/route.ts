import { NextRequest, NextResponse } from "next/server";
import {
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
import { getSttConfig } from "@/lib/stt/config";
import { transcribePracticeAudio } from "@/lib/stt/transcription";
import { parseMotionBriefForStt } from "@/lib/stt/request";
import { PRACTICE_AUDIO_BUCKET } from "@/lib/practice-analysis/constants";
import type { PracticeLanguage, PracticeTrack } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 26_214_400;
const STORAGE_DOWNLOAD_TIMEOUT_MS = 15_000;

type FinalizeTranscriptionRequest = {
  bucket: "practice-audio";
  path: string;
  contentType: string;
  byteSize: number;
  durationSeconds: number;
  practiceLanguage: PracticeLanguage;
  practiceTrack?: PracticeTrack;
  topic?: string;
  side?: "proposition" | "opposition" | "random";
  motionBrief?: ReturnType<typeof parseMotionBriefForStt>;
  prepNotes?: string;
};

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

function parseRequest(body: JsonRecord): FinalizeTranscriptionRequest {
  const bucket = getString(body, "bucket", {
    required: true,
    maxLength: 80,
  });
  if (bucket !== PRACTICE_AUDIO_BUCKET) {
    throw new RequestValidationError("bucket is invalid.");
  }
  const contentType = getString(body, "contentType", {
    required: true,
    maxLength: 80,
  })!;
  const byteSize = getNumber(body, "byteSize", {
    required: true,
    min: 1,
  })!;
  if (byteSize > MAX_AUDIO_BYTES) {
    throw new RequestValidationError("byteSize is too large.", 413);
  }
  const language = getString(body, "practiceLanguage", {
    maxLength: 8,
    defaultValue: "en",
  });
  return {
    bucket: PRACTICE_AUDIO_BUCKET,
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
    practiceLanguage: language === "vi" ? "vi" : "en",
    practiceTrack: body.practiceTrack === "speaking" ? "speaking" : "debate",
    topic: getString(body, "topic", { maxLength: 300 }),
    side:
      body.side === "proposition" ||
      body.side === "opposition" ||
      body.side === "random"
        ? body.side
        : undefined,
    motionBrief: parseMotionBriefForStt(body.motionBrief),
    prepNotes: getString(body, "prepNotes", { maxLength: 12000 }),
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new TimeoutError(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function pathBelongsToUser(path: string, userId: string) {
  return path.startsWith(`${userId}/`);
}

export async function POST(request: NextRequest) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;

  const { supabase, user } = auth;
  if (shouldConsumeUserRateLimit(auth)) {
    const rateLimit = await consumeRateLimit(supabase, {
      scope: "practice_transcription_finalize",
      limit: 8,
      windowSeconds: 600,
    });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many transcription requests. Please wait a moment." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }
  }

  let input: FinalizeTranscriptionRequest;
  try {
    input = parseRequest(await readJsonObject(request, { maxBytes: 20 * 1024 }));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid transcription request.",
      },
      { status: error instanceof RequestValidationError ? error.status : 400 }
    );
  }

  if (!getSttConfig().finalRetranscribeEnabled) {
    return NextResponse.json(
      { error: "Final transcription is disabled.", code: "stt_disabled" },
      { status: 409 }
    );
  }

  if (!pathBelongsToUser(input.path, user.id)) {
    return NextResponse.json(
      { error: "Audio object does not belong to the authenticated user." },
      { status: 403 }
    );
  }

  let audioBlob: Blob | null = null;
  try {
    const result = await withTimeout(
      supabase.storage.from(input.bucket).download(input.path),
      STORAGE_DOWNLOAD_TIMEOUT_MS,
      "Audio download timed out."
    );
    if (result.error) {
      return NextResponse.json(
        { error: "Audio object was not found.", code: "audio_not_found" },
        { status: 404 }
      );
    }
    audioBlob = result.data;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof TimeoutError
            ? error.message
            : "Unable to read practice audio.",
        code:
          error instanceof TimeoutError
            ? "audio_download_timeout"
            : "audio_download_failed",
      },
      { status: error instanceof TimeoutError ? 504 : 500 }
    );
  }

  if (!audioBlob || audioBlob.size <= 0) {
    return NextResponse.json(
      { error: "Audio object was empty.", code: "audio_empty" },
      { status: 400 }
    );
  }
  if (audioBlob.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Audio object is larger than the 25 MB transcription limit." },
      { status: 413 }
    );
  }

  const transcription = await transcribePracticeAudio({
    audioBuffer: await audioBlob.arrayBuffer(),
    contentType: input.contentType,
    practiceLanguage: input.practiceLanguage,
    practiceTrack: input.practiceTrack,
    audioBucket: input.bucket,
    audioStoragePath: input.path,
    durationSeconds: input.durationSeconds,
    topic: input.topic,
    side: input.side,
    motionBrief: input.motionBrief,
    prepNotes: input.prepNotes,
  });

  return NextResponse.json({
    transcription,
    audio: {
      bucket: input.bucket,
      path: input.path,
      byteSize: audioBlob.size,
      contentType: input.contentType,
      durationSeconds: input.durationSeconds,
    },
  });
}
