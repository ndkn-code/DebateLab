/**
 * Encode mono PCM samples into a 16-bit WAV (RIFF) container (WS-5.2).
 *
 * Browsers capture speech as compressed webm/opus (or mp4/aac on Safari), but
 * Azure pronunciation assessment only accepts WAV PCM 16 kHz mono. The recorder
 * decodes + resamples the capture to 16 kHz mono `Float32` in the browser (Web
 * Audio), then this pure encoder writes the WAV bytes that are uploaded and later
 * handed to Azure. Pure (no DOM) so the wire format is unit-tested without audio.
 */

/** Sample rate Azure pronunciation assessment expects (16 kHz mono PCM). */
export const IELTS_PRONUNCIATION_SAMPLE_RATE = 16000;

const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;
const WAV_HEADER_BYTES = 44;

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/** Clamp a [-1, 1] float sample to a signed 16-bit PCM integer. */
function floatToInt16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  return Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
}

/**
 * Encode `samples` (mono, normalized [-1, 1]) as a 16-bit PCM WAV at
 * `sampleRate`. Returns the full RIFF buffer (44-byte header + PCM data).
 */
export function encodeWavPcm16(
  samples: Float32Array,
  sampleRate: number,
): ArrayBuffer {
  const bytesPerSample = BITS_PER_SAMPLE / 8;
  const blockAlign = NUM_CHANNELS * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor.
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  // "fmt " sub-chunk.
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, NUM_CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  // "data" sub-chunk.
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = WAV_HEADER_BYTES;
  for (let i = 0; i < samples.length; i += 1, offset += bytesPerSample) {
    view.setInt16(offset, floatToInt16(samples[i]), true);
  }
  return buffer;
}
