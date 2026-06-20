/**
 * Concatenate per-turn MP3 buffers into a single stream (WS-1.3). Pure + unit
 * tested.
 *
 * Deepgram and Google both return MP3 (MPEG audio frames); concatenating the
 * frame streams yields one continuous, playable MP3 — the standard pragmatic
 * approach for stitching short TTS clips. Each clip carries its own natural
 * trailing pause, so no synthetic silence spacer is inserted.
 */

/** Concatenate MP3 turn buffers in order into one `Uint8Array`. */
export function concatenateAudioBuffers(
  parts: readonly ArrayBuffer[],
): Uint8Array {
  const views = parts.map((part) => new Uint8Array(part));
  const total = views.reduce((sum, view) => sum + view.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const view of views) {
    out.set(view, offset);
    offset += view.byteLength;
  }
  return out;
}
