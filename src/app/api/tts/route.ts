import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { text, voice } = await req.json();

  if (!text || text.length > 5000) {
    return NextResponse.json({ error: 'Text required (max 5000 chars)' }, { status: 400 });
  }

  const voiceModel = voice || 'aura-asteria-en';
  const startTime = Date.now();

  try {
    const response = await fetch(`https://api.deepgram.com/v1/speak?model=${voiceModel}&encoding=mp3`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
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
    if (process.env.NODE_ENV === 'development') console.error('TTS route error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
