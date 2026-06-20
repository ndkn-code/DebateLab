import assert from "node:assert/strict";
import { concatenateAudioBuffers } from "./audio-buffer";

function buf(...bytes: number[]): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

// --- concatenation preserves order and length ------------------------------
const out = concatenateAudioBuffers([buf(1, 2), buf(3), buf(4, 5, 6)]);
assert.equal(out.byteLength, 6);
assert.deepEqual([...out], [1, 2, 3, 4, 5, 6]);

// --- empty input → empty output --------------------------------------------
assert.equal(concatenateAudioBuffers([]).byteLength, 0);

// --- single buffer round-trips unchanged -----------------------------------
assert.deepEqual([...concatenateAudioBuffers([buf(9, 8, 7)])], [9, 8, 7]);

console.log("ielts/listening-audio/audio-buffer tests passed");
