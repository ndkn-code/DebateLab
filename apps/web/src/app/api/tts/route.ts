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
import { synthesizeTtsVoice } from '@/lib/tts-providers';
import type { PracticeLanguage } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRequestAuth(req);
    if (!auth.ok) return auth.errorResponse;

    const { supabase, user: authUser } = auth;
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

    const startTime = Date.now();
    const audioBuffer = await synthesizeTtsVoice(text, voice);
    const durationMs = Date.now() - startTime;
    const service =
      voice.provider === "azure"
        ? "azure_tts"
        : voice.provider === "google"
          ? "google_tts"
          : "deepgram_tts";

    // Log to Supabase api_usage (non-blocking)
    supabase.from('api_usage').insert({
      user_id: authUser.id,
      service,
      model: voice.id,
      input_tokens: text.length,
      input_unit: 'characters',
      output_tokens: audioBuffer.byteLength,
      output_unit: 'bytes',
      duration_ms: durationMs,
      metadata: {
        provider: voice.provider,
        language: voice.language,
        locale: voice.locale,
        text_length: text.length,
        audio_size_bytes: audioBuffer.byteLength,
      },
    }).then(() => {}); // fire and forget

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'X-TTS-Duration-Ms': durationMs.toString(),
      },
    });
  } catch (err) {
    if (err instanceof RequestValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (process.env.NODE_ENV === 'development') console.error('TTS route error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
