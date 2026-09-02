import assert from "node:assert/strict";

import {
  PracticeTranscriptionProvidersError,
  transcribePracticeAudio,
} from "./transcription";

const originalFetch = globalThis.fetch;
const originalDeepgramKey = process.env.DEEPGRAM_API_KEY;
const originalGroqKey = process.env.GROQ_API_KEY;
const originalRepair = process.env.STT_JUDGE_TRANSCRIPT_REPAIR_SHADOW_ENABLED;

const input = {
  audioBuffer: new Uint8Array([1, 2, 3]).buffer,
  contentType: "audio/webm",
  practiceLanguage: "en" as const,
  audioBucket: "practice-audio" as const,
  audioStoragePath: "user/test/source.webm",
  durationSeconds: 3,
  practiceTrack: "speaking" as const,
};

async function main() {
  try {
    process.env.DEEPGRAM_API_KEY = "deepgram-test";
    delete process.env.GROQ_API_KEY;
    process.env.STT_JUDGE_TRANSCRIPT_REPAIR_SHADOW_ENABLED = "false";

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          metadata: { request_id: "dg-empty" },
          results: { channels: [{ alternatives: [{ transcript: "" }] }] },
        }),
        { status: 200 },
      );
    const noSpeech = await transcribePracticeAudio(input);
    assert.equal(noSpeech.transcript, "");
    assert.ok(noSpeech.warnings.includes("no_speech_detected"));
    assert.equal(noSpeech.alternatives?.[0]?.errorCode, undefined);

    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    await assert.rejects(
      () => transcribePracticeAudio(input),
      (error: unknown) => {
        assert.ok(error instanceof PracticeTranscriptionProvidersError);
        assert.equal(error.code, "STT_ALL_PROVIDERS_FAILED");
        assert.equal(error.retryable, true);
        assert.deepEqual(error.attempts, [
          { provider: "deepgram", errorCode: "deepgram_failed" },
        ]);
        return true;
      },
    );

    globalThis.fetch = async () => new Response("not-json", { status: 200 });
    delete process.env.GROQ_API_KEY;
    await assert.rejects(
      () => transcribePracticeAudio(input),
      (error: unknown) => {
        assert.ok(error instanceof PracticeTranscriptionProvidersError);
        assert.deepEqual(error.attempts, [
          { provider: "deepgram", errorCode: "deepgram_invalid_response" },
        ]);
        return true;
      },
    );

    process.env.GROQ_API_KEY = "groq-test";
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    await assert.rejects(
      () =>
        transcribePracticeAudio({
          ...input,
          practiceLanguage: "vi",
          practiceTrack: "debate",
        }),
      (error: unknown) => {
        assert.ok(error instanceof PracticeTranscriptionProvidersError);
        assert.deepEqual(error.attempts, [
          { provider: "deepgram", errorCode: "deepgram_failed" },
          { provider: "groq", errorCode: "groq_failed" },
        ]);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDeepgramKey === undefined) delete process.env.DEEPGRAM_API_KEY;
    else process.env.DEEPGRAM_API_KEY = originalDeepgramKey;
    if (originalGroqKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalGroqKey;
    if (originalRepair === undefined) {
      delete process.env.STT_JUDGE_TRANSCRIPT_REPAIR_SHADOW_ENABLED;
    } else {
      process.env.STT_JUDGE_TRANSCRIPT_REPAIR_SHADOW_ENABLED = originalRepair;
    }
  }

  console.log("stt/transcription reliability tests passed");
}

void main();
