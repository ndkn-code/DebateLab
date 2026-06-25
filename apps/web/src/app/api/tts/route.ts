import { NextRequest, NextResponse } from 'next/server';
import {
  requireRequestAuth,
  shouldConsumeUserRateLimit,
} from '@/lib/api/request-auth';
import {
  readJsonObject,
  getEnum,
  getString,
  RequestValidationError,
} from '@/lib/api/request-validation';
import { consumeRateLimit } from '@/lib/rate-limit';
import {
  DEFAULT_VOICE,
  getVoiceById,
  resolveTtsVoiceForRequest,
} from '@/lib/tts-voices';
import {
  recordTtsProviderAttempts,
  synthesizeTtsWithFallback,
  TtsSynthesisFailedError,
  type TtsProviderAttempt,
} from '@/lib/tts-service';
import type { PracticeLanguage } from '@/types';

function logTtsFailedAttempts(
  attempts: TtsProviderAttempt[],
  context: {
    language: PracticeLanguage;
    requestedVoiceId: string;
    selectedVoiceId?: string | null;
    fallbackUsed: boolean;
    textLength: number;
  }
) {
  for (const [attemptIndex, attempt] of attempts.entries()) {
    if (attempt.status !== "error") continue;
    console.error(
      JSON.stringify({
        event: "tts_provider_attempt_failed",
        source_route: "/api/tts",
        provider: attempt.provider,
        voice: attempt.voiceId,
        status: attempt.status,
        response_status: attempt.responseStatus ?? null,
        latency_ms: attempt.latencyMs,
        error_code: attempt.errorCode ?? null,
        language: context.language,
        requested_voice: context.requestedVoiceId,
        selected_voice: context.selectedVoiceId ?? null,
        fallback_used: context.fallbackUsed,
        text_length: context.textLength,
        attempt_index: attemptIndex,
        skipped: attempt.skipped === true,
      })
    );
  }
}

export async function POST(req: NextRequest) {
  let failureContext: {
    language: PracticeLanguage;
    requestedVoiceId: string;
    textLength: number;
    userId?: string | null;
  } | null = null;

  try {
    const auth = await requireRequestAuth(req);
    if (!auth.ok) return auth.errorResponse;

    const { supabase, user: authUser } = auth;
    const telemetryUserId =
      auth.authSource === "dev-bypass" ? null : authUser.id;
    if (shouldConsumeUserRateLimit(auth)) {
      const rateLimit = await consumeRateLimit(supabase, {
        scope: "tts",
        limit: 20,
        windowSeconds: 60,
      });
      if (!rateLimit.success) {
        return NextResponse.json(
          { error: "Too many requests. Please wait a moment." },
          {
            status: 429,
            headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
          }
        );
      }
    }

    const body = await readJsonObject(req, { maxBytes: 12 * 1024 });
    const text = getString(body, "text", {
      required: true,
      minLength: 1,
      maxLength: 5000,
    })!;
    const requestedVoice = getString(body, "voice", {
      maxLength: 64,
      defaultValue: DEFAULT_VOICE,
    })!;
    const requestedVoiceRecord = getVoiceById(requestedVoice);
    const requestedLanguage = getEnum(
      body,
      "practiceLanguage",
      ["en", "vi"] as const,
      {
        defaultValue: requestedVoiceRecord?.language ?? "en",
      }
    ) as PracticeLanguage;
    const voiceModel = resolveTtsVoiceForRequest(requestedVoice, requestedLanguage);
    const voice = getVoiceById(voiceModel) ?? getVoiceById(DEFAULT_VOICE)!;
    failureContext = {
      language: requestedLanguage,
      requestedVoiceId: voice.id,
      textLength: text.length,
      userId: telemetryUserId,
    };

    const result = await synthesizeTtsWithFallback(text, voice);
    const { audioBuffer } = result;
    const durationMs = result.latencyMs;
    const service =
      result.voice.provider === "azure"
        ? "azure_tts"
        : result.voice.provider === "google"
          ? "google_tts"
          : "deepgram_tts";

    logTtsFailedAttempts(result.attempts, {
      language: requestedLanguage,
      requestedVoiceId: voice.id,
      selectedVoiceId: result.voice.id,
      fallbackUsed: result.fallbackUsed,
      textLength: text.length,
    });

    await recordTtsProviderAttempts(result.attempts, {
      language: requestedLanguage,
      requestedVoiceId: voice.id,
      selectedVoiceId: result.voice.id,
      fallbackUsed: result.fallbackUsed,
      textLength: text.length,
      userId: telemetryUserId,
    });

    if (telemetryUserId) {
      void supabase.from('api_usage').insert({
        user_id: telemetryUserId,
        service,
        model: result.voice.id,
        input_tokens: text.length,
        input_unit: 'characters',
        output_tokens: audioBuffer.byteLength,
        output_unit: 'bytes',
        duration_ms: durationMs,
        metadata: {
          provider: result.voice.provider,
          language: result.voice.language,
          locale: result.voice.locale,
          requested_voice: voice.id,
          fallback_used: result.fallbackUsed,
          text_length: text.length,
          audio_size_bytes: audioBuffer.byteLength,
        },
      });
    }

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'X-TTS-Duration-Ms': durationMs.toString(),
        'X-TTS-Synthesis-Ms': durationMs.toString(),
        'X-TTS-Provider': result.voice.provider,
        'X-TTS-Voice': result.voice.id,
        'X-TTS-Fallback-Used': String(result.fallbackUsed),
      },
    });
  } catch (err) {
    if (err instanceof RequestValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof TtsSynthesisFailedError) {
      const context = failureContext ?? {
        language: "en" as PracticeLanguage,
        requestedVoiceId: "unknown",
        textLength: 0,
        userId: null,
      };
      logTtsFailedAttempts(err.attempts, {
        language: context.language,
        requestedVoiceId: context.requestedVoiceId,
        selectedVoiceId: null,
        fallbackUsed: false,
        textLength: context.textLength,
      });
      await recordTtsProviderAttempts(err.attempts, {
        language: context.language,
        requestedVoiceId: context.requestedVoiceId,
        selectedVoiceId: null,
        fallbackUsed: false,
        textLength: context.textLength,
        userId: context.userId,
      });
      return NextResponse.json(
        {
          error:
            "AI voice could not be generated right now. Please try audio again.",
        },
        { status: 503 }
      );
    }
    if (process.env.NODE_ENV === 'development') console.error('TTS route error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
