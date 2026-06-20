/**
 * Storage bucket + path/URL helpers for generated Listening audio (WS-1.3).
 * Pure + unit tested.
 *
 * The path is keyed by section id (one stable object per section), so a
 * regeneration overwrites in place rather than accumulating duplicate blobs.
 * The public URL carries a `?v=<version>` cache-buster so a fresh take is served
 * even though the path is reused.
 */

/** Public bucket holding generated Listening audio. */
export const IELTS_LISTENING_AUDIO_BUCKET = "ielts-listening-audio";

/** Stable storage object path for a section's generated audio. */
export function listeningAudioStoragePath(sectionId: string): string {
  return `sections/${sectionId}.mp3`;
}

/** Build the public, cache-busted URL for a stored audio object. */
export function publicListeningAudioUrl(
  supabaseUrl: string | undefined,
  storagePath: string | null,
  version: number,
): string | null {
  if (!supabaseUrl || !storagePath) return null;
  const base = supabaseUrl.replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${IELTS_LISTENING_AUDIO_BUCKET}/${storagePath}?v=${version}`;
}
