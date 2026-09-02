import assert from "node:assert/strict";
import test from "node:test";

import {
  createGeminiLivePcmAudioMessage,
  createGeminiLiveTranscriptionSetup,
  GEMINI_LIVE_TRANSCRIPTION_AUDIO_REQUIREMENTS,
  GEMINI_LIVE_TRANSCRIPTION_MODEL_RESOURCE,
  parseGeminiLiveTranscriptionServerMessage,
} from "./gemini-live-contract";

test("setup is locked to Transcribe Live, VERBATIM, and text output", () => {
  const setup = createGeminiLiveTranscriptionSetup();
  assert.equal(setup.setup.model, GEMINI_LIVE_TRANSCRIPTION_MODEL_RESOURCE);
  assert.deepEqual(setup.setup.generationConfig.responseModalities, ["TEXT"]);
  assert.equal(setup.setup.inputAudioTranscription.mode, "VERBATIM");
  assert.deepEqual(GEMINI_LIVE_TRANSCRIPTION_AUDIO_REQUIREMENTS, {
    encoding: "pcm_s16le",
    sampleRateHz: 16_000,
    channels: 1,
    bitsPerSample: 16,
    littleEndian: true,
    mimeType: "audio/pcm;rate=16000",
    minimumPrerollMs: 300,
  });
  assert.equal(
    createGeminiLivePcmAudioMessage("AAEC").realtimeInput.audio.mimeType,
    "audio/pcm;rate=16000",
  );
});

test("parser preserves VERBATIM interim and final text exactly", () => {
  const events = parseGeminiLiveTranscriptionServerMessage({
    serverContent: {
      interimInputTranscription: {
        text: "  Um I, I think ",
        languageCode: "en-US",
      },
      inputTranscription: {
        text: "Um I, I think... uh, yes.",
        languageCode: "en-US",
      },
    },
  });
  assert.deepEqual(events, [
    {
      type: "interim",
      text: "  Um I, I think ",
      languageCode: "en-US",
    },
    {
      type: "final",
      text: "Um I, I think... uh, yes.",
      languageCode: "en-US",
    },
  ]);
});

test("parser accepts setup JSON and ignores malformed or unrelated messages", () => {
  assert.deepEqual(
    parseGeminiLiveTranscriptionServerMessage('{"setupComplete":{}}'),
    [{ type: "setup_complete" }],
  );
  assert.deepEqual(parseGeminiLiveTranscriptionServerMessage("not json"), []);
  assert.deepEqual(
    parseGeminiLiveTranscriptionServerMessage({
      serverContent: { turnComplete: true },
    }),
    [],
  );
});
