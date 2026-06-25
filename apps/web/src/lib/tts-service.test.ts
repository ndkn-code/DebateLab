import assert from "node:assert/strict";
import {
  buildTtsTelemetryPayload,
  buildTtsVoiceFallbackList,
  synthesizeTtsWithFallback,
  TtsSynthesisFailedError,
  type TtsProviderAttempt,
  type TtsProviderEnvironment,
} from "@/lib/tts-service";
import { getVoiceById, type TTSVoice } from "@/lib/tts-voices";

const googleVietnameseVoiceRecord = getVoiceById("vi-VN-Chirp3-HD-Kore");
const azureVietnameseVoiceRecord = getVoiceById("vi-VN-HoaiMyNeural");
const englishVoiceRecord = getVoiceById("aura-asteria-en");
assert.ok(googleVietnameseVoiceRecord);
assert.ok(azureVietnameseVoiceRecord);
assert.ok(englishVoiceRecord);
const googleVietnameseVoice = googleVietnameseVoiceRecord;
const azureVietnameseVoice = azureVietnameseVoiceRecord;
const englishVoice = englishVoiceRecord;

const vietnameseFallbackIds = buildTtsVoiceFallbackList(
  googleVietnameseVoice,
  4
).map((voice) => voice.id);
assert.equal(vietnameseFallbackIds[0], "vi-VN-Chirp3-HD-Kore");
assert.ok(vietnameseFallbackIds.includes(azureVietnameseVoice.id));

const englishFallbackIds = buildTtsVoiceFallbackList(englishVoice, 3).map(
  (voice) => voice.id
);
assert.equal(englishFallbackIds[0], "aura-asteria-en");
assert.ok(englishFallbackIds.some((voiceId) => voiceId !== "aura-asteria-en"));

async function main() {
  const azureOnlyEnv: TtsProviderEnvironment = {
    AZURE_SPEECH_KEY: "test",
    AZURE_SPEECH_REGION: "eastus",
  };
  const fallbackCalls: string[] = [];
  const fallbackResult = await synthesizeTtsWithFallback(
    "Xin chào",
    googleVietnameseVoice,
    {
      env: azureOnlyEnv,
      maxVoices: 2,
      retries: 0,
      synthesize: async (_text: string, voice: TTSVoice) => {
        fallbackCalls.push(voice.id);
        return new Uint8Array([1, 2, 3]).buffer;
      },
    }
  );
  assert.deepEqual(fallbackCalls, ["vi-VN-HoaiMyNeural"]);
  assert.equal(fallbackResult.voice.id, "vi-VN-HoaiMyNeural");
  assert.equal(fallbackResult.fallbackUsed, true);
  assert.equal(fallbackResult.attempts[0].status, "error");
  assert.equal(fallbackResult.attempts[0].errorCode, "PROVIDER_UNAVAILABLE");
  assert.equal(fallbackResult.attempts[1].status, "success");

  let transientCalls = 0;
  const transientResult = await synthesizeTtsWithFallback("Hello", englishVoice, {
    env: { DEEPGRAM_API_KEY: "test" },
    maxVoices: 1,
    retries: 1,
    synthesize: async () => {
      transientCalls += 1;
      if (transientCalls === 1) {
        throw new Error("temporary upstream failure");
      }
      return new Uint8Array([4, 5, 6]).buffer;
    },
  });
  assert.equal(transientCalls, 2);
  assert.deepEqual(
    transientResult.attempts.map((attempt) => attempt.status),
    ["error", "success"]
  );

  let failedError: unknown = null;
  try {
    await synthesizeTtsWithFallback("Hello", englishVoice, {
      env: { DEEPGRAM_API_KEY: "test" },
      maxVoices: 1,
      retries: 0,
      synthesize: async () => {
        throw new Error("DEEPGRAM_TTS_FAILED: request body omitted");
      },
    });
  } catch (error) {
    failedError = error;
  }
  assert.ok(failedError instanceof TtsSynthesisFailedError);
  assert.equal(failedError.attempts.length, 1);
  assert.equal(failedError.attempts[0].errorCode, "DEEPGRAM_TTS_FAILED");

  const telemetryAttempt: TtsProviderAttempt = {
    provider: "google",
    voiceId: "vi-VN-Chirp3-HD-Kore",
    status: "error",
    latencyMs: 321,
    responseStatus: 500,
    errorCode: "GOOGLE_TTS_FAILED",
    errorMessage: "GOOGLE_TTS_FAILED",
  };
  const telemetry = buildTtsTelemetryPayload(telemetryAttempt, {
    language: "vi",
    requestedVoiceId: "vi-VN-Chirp3-HD-Kore",
    selectedVoiceId: null,
    fallbackUsed: false,
    textLength: 42,
    userId: "user_123",
    attemptIndex: 0,
  });
  assert.equal(telemetry.provider, "google_tts");
  assert.equal(telemetry.model, "vi-VN-Chirp3-HD-Kore");
  assert.equal(telemetry.sourceRoute, "/api/tts");
  assert.equal(telemetry.outputType, null);
  assert.equal(telemetry.errorCode, "GOOGLE_TTS_FAILED");
  assert.doesNotMatch(JSON.stringify(telemetry), /Xin chào|Hello/);

  console.log("TTS fallback service tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
