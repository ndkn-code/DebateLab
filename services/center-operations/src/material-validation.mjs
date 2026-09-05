import { createHash } from 'node:crypto';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

// Mirrors detectMaterialMime in apps/web/src/lib/api/class-lms/material-pipeline/contracts.ts.
export function detectMaterialMime(bytes, declaredMime) {
  const starts = (...values) => values.every((value, index) => bytes[index] === value);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return 'application/pdf';
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) return declaredMime === 'audio/x-wav' ? declaredMime : 'audio/wav';
  if (starts(0x49, 0x44, 0x33) || (bytes[0] === 0xff && bytes[1] !== undefined && (bytes[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return 'audio/mp4';
  if (starts(0x50, 0x4b, 0x03, 0x04)) {
    const archiveNames = Buffer.from(bytes).toString('latin1');
    if (archiveNames.includes('word/')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (archiveNames.includes('ppt/')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    return null;
  }
  if (starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1) && ['application/msword', 'application/vnd.ms-powerpoint'].includes(declaredMime)) return declaredMime;
  if (declaredMime === 'text/plain' && !bytes.includes(0)) {
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return declaredMime; } catch { return null; }
  }
  return null;
}

export function validateMaterialBytes(bytes, declaredMime, expectedVersion) {
  const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  if (!(view instanceof Uint8Array) || view.byteLength === 0) throw new Error('Google material is empty');
  if (view.byteLength > MAX_FILE_BYTES) throw new Error('Google material exceeds the 20 MB limit');
  const detectedMime = detectMaterialMime(view, declaredMime);
  if (!detectedMime || detectedMime !== declaredMime) throw new Error('Google material MIME type does not match its contents');
  const version = createHash('sha256').update(view).digest('hex');
  if (version !== expectedVersion) throw new Error('Google material hash does not match its version');
  return { bytes: view, detectedMime };
}
