import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readJsonObject, getString, RequestValidationError } from '@/lib/api/request-validation';
import { consumeRateLimit } from '@/lib/rate-limit';
import { DEFAULT_VOICE, TTS_VOICES } from '@/lib/tts-voices';

const ALLOWED_VOICES = new Set(TTS_VOICES.map((voice) => voice.id));

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    const voiceModel = ALLOWED_VOICES.has(requestedVoice)
      ? requestedVoice
      : DEFAULT_VOICE;

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }

    const startTime = Date.now();
    const response = await fetch(`https://api.deepgram.com/v1/speak?model=${voiceModel}&encoding=mp3`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.text();
      if (process.env.NODE_ENV === 'development') console.error('Deepgram TTS error:', error);
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }

    const audioBuffer = await response.arrayBuffer();
    const durationMs = Date.now() - startTime;

    // Log to Supabase api_usage (non-blocking)
    supabase.from('api_usage').insert({
      user_id: user.id,
      service: 'deepgram_tts',
      model: voiceModel,
      input_tokens: text.length,
      input_unit: 'characters',
      output_tokens: audioBuffer.byteLength,
      output_unit: 'bytes',
      duration_ms: durationMs,
      metadata: {
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
