"use client";

/**
 * Listening audio playback (WS-2.1). Plays the section's generated audio
 * (audio_assets, produced by WS-1.3). Degrades gracefully when a track has no
 * storage URL yet (content still being authored / TTS pending) so the timed
 * section is still sittable.
 */

export interface ListeningAudioTrack {
  id: string;
  label: string;
  src: string | null;
}

export function ListeningAudioPlayer({ tracks }: { tracks: ListeningAudioTrack[] }) {
  if (tracks.length === 0) return null;
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-outline-variant bg-surface-container p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        Listening audio
      </p>
      {tracks.map((track) => (
        <div key={track.id} className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-on-surface">{track.label}</span>
          {track.src ? (
            <audio
              controls
              preload="none"
              src={track.src}
              className="w-full"
            >
              <track kind="captions" />
            </audio>
          ) : (
            <p className="rounded-2xl bg-surface px-4 py-3 text-sm text-on-surface-variant">
              Audio is being prepared — this section is still sittable.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
