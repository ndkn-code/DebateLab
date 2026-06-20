import assert from "node:assert/strict";
import {
  AZURE_PRONUNCIATION_WAV_CONTENT_TYPE,
  azurePronunciationContentType,
} from "./audio-format";

// WAV inputs (however labelled) collapse to the exact Azure header.
assert.equal(
  azurePronunciationContentType("audio/wav"),
  AZURE_PRONUNCIATION_WAV_CONTENT_TYPE,
);
assert.equal(
  azurePronunciationContentType("audio/wav; codecs=audio/pcm; samplerate=16000"),
  AZURE_PRONUNCIATION_WAV_CONTENT_TYPE,
);
assert.equal(
  azurePronunciationContentType("AUDIO/WAV"),
  AZURE_PRONUNCIATION_WAV_CONTENT_TYPE,
  "case-insensitive",
);
assert.equal(
  azurePronunciationContentType("audio/x-wav"),
  AZURE_PRONUNCIATION_WAV_CONTENT_TYPE,
);
assert.equal(
  azurePronunciationContentType("application/octet-stream; codecs=audio/pcm"),
  AZURE_PRONUNCIATION_WAV_CONTENT_TYPE,
  "raw PCM is also assessable",
);

// Non-WAV inputs pass through untouched (Azure declines them → graceful no-op).
assert.equal(azurePronunciationContentType("audio/webm"), "audio/webm");
assert.equal(azurePronunciationContentType("audio/mp4"), "audio/mp4");
assert.equal(azurePronunciationContentType(""), "");

console.log("ielts/pronunciation/audio-format tests passed");
