import assert from "node:assert/strict";
import { encodeWavPcm16, IELTS_PRONUNCIATION_SAMPLE_RATE } from "./wav-encoder";

function ascii(view: DataView, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(view.getUint8(offset + i));
  return out;
}

// --- empty input: header only, well-formed RIFF/WAVE -------------------------
{
  const buffer = encodeWavPcm16(new Float32Array(0), IELTS_PRONUNCIATION_SAMPLE_RATE);
  assert.equal(buffer.byteLength, 44, "empty WAV is a bare 44-byte header");
  const view = new DataView(buffer);
  assert.equal(ascii(view, 0, 4), "RIFF");
  assert.equal(ascii(view, 8, 4), "WAVE");
  assert.equal(ascii(view, 12, 4), "fmt ");
  assert.equal(ascii(view, 36, 4), "data");
  assert.equal(view.getUint32(4, true), 36, "RIFF size = 36 + dataSize(0)");
  assert.equal(view.getUint32(40, true), 0, "data size = 0");
}

// --- fmt chunk: PCM, mono, 16-bit, 16 kHz ------------------------------------
{
  const view = new DataView(encodeWavPcm16(new Float32Array(4), 16000));
  assert.equal(view.getUint16(20, true), 1, "audioFormat = PCM (1)");
  assert.equal(view.getUint16(22, true), 1, "mono (1 channel)");
  assert.equal(view.getUint32(24, true), 16000, "sample rate = 16000");
  assert.equal(view.getUint16(34, true), 16, "16 bits per sample");
  assert.equal(view.getUint32(28, true), 16000 * 2, "byteRate = rate * blockAlign");
  assert.equal(view.getUint16(32, true), 2, "blockAlign = channels * bytesPerSample");
}

// --- sample quantization + clamping ------------------------------------------
{
  // 0 → 0, +1 → 0x7fff, -1 → -0x8000, 0.5 → ~16384, out-of-range clamps.
  const samples = new Float32Array([0, 1, -1, 0.5, 2, -2]);
  const buffer = encodeWavPcm16(samples, 16000);
  assert.equal(buffer.byteLength, 44 + samples.length * 2);
  const view = new DataView(buffer);
  assert.equal(view.getInt16(44 + 0 * 2, true), 0);
  assert.equal(view.getInt16(44 + 1 * 2, true), 32767);
  assert.equal(view.getInt16(44 + 2 * 2, true), -32768);
  assert.equal(view.getInt16(44 + 3 * 2, true), 16384);
  assert.equal(view.getInt16(44 + 4 * 2, true), 32767, "above 1.0 clamps to max");
  assert.equal(view.getInt16(44 + 5 * 2, true), -32768, "below -1.0 clamps to min");
  // data size header matches the PCM payload length.
  assert.equal(view.getUint32(40, true), samples.length * 2);
  assert.equal(view.getUint32(4, true), 36 + samples.length * 2);
}

console.log("ielts/audio/wav-encoder tests passed");
