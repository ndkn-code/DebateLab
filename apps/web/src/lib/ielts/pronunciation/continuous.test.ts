import assert from "node:assert/strict";

import {
  encodeWavPcm16,
  IELTS_PRONUNCIATION_SAMPLE_RATE,
} from "@/lib/ielts/audio/wav-encoder";
import { parsePronunciationWav } from "./continuous";

const samples = new Float32Array(IELTS_PRONUNCIATION_SAMPLE_RATE * 2);
const wav = encodeWavPcm16(samples, IELTS_PRONUNCIATION_SAMPLE_RATE);
const parsed = parsePronunciationWav(wav);
assert.equal(parsed.durationSeconds, 2);
assert.equal(parsed.pcm.byteLength, samples.length * 2);

assert.throws(
  () => parsePronunciationWav(new Uint8Array([1, 2, 3])),
  /PRONUNCIATION_WAV_TOO_SHORT/,
);
assert.throws(
  () => parsePronunciationWav(encodeWavPcm16(samples, 8_000)),
  /PRONUNCIATION_WAV_UNSUPPORTED_FORMAT/,
);

console.log("ielts/pronunciation/continuous tests passed");
