"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProductIcon } from "@/components/ui/product-icon";
import {
  listeningPlaybackKey,
  useListeningPlaybackStore,
} from "@/lib/stores/listeningPlaybackStore";
import {
  ListeningAudioHeader,
  ListeningAudioOverlay,
  ListeningAudioUnavailable,
  type ListeningPlaybackStatus,
} from "./ListeningAudioOverlay";

export interface ListeningAudioTrack {
  id: string;
  label: string;
  src: string | null;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${(wholeSeconds % 60).toString().padStart(2, "0")}`;
}

export function ListeningAudioPlayer({
  tracks,
  attemptId,
  partId,
  playbackBlocked,
  anotherPartPlaying,
  onPlaybackChange,
  onEnded,
}: {
  tracks: ListeningAudioTrack[];
  attemptId: string;
  partId: string;
  playbackBlocked: boolean;
  anotherPartPlaying: boolean;
  onPlaybackChange: (partId: string, playing: boolean) => void;
  onEnded?: () => void;
}) {
  const track = tracks[0];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const statusRef = useRef<ListeningPlaybackStatus>("gate");
  const blockedRef = useRef(playbackBlocked);
  const lastAllowedTimeRef = useRef(0);
  const restoringSeekRef = useRef(false);
  const [status, setStatus] = useState<ListeningPlaybackStatus>("gate");
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const hydrateAttempt = useListeningPlaybackStore((store) => store.hydrateAttempt);
  const hydrated = useListeningPlaybackStore(
    (store) => store.hydratedAttempts[attemptId] === true,
  );
  const played = useListeningPlaybackStore(
    (store) => store.playedParts[listeningPlaybackKey(attemptId, partId)] === true,
  );
  const markPlayed = useListeningPlaybackStore((store) => store.markPlayed);

  const updateStatus = useCallback((nextStatus: ListeningPlaybackStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  useEffect(() => {
    hydrateAttempt(attemptId);
  }, [attemptId, hydrateAttempt]);

  useEffect(() => {
    blockedRef.current = playbackBlocked;
    const audio = audioRef.current;
    if (!playbackBlocked || !audio || audio.paused) return;
    audio.pause();
  }, [playbackBlocked]);

  if (tracks.length === 0) return null;

  if (!track?.src) {
    return <ListeningAudioUnavailable />;
  }

  const locked = played && status !== "starting" && status !== "playing";
  const progress = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;
  const audioSrc = !hydrated || locked ? undefined : track.src;

  const startPlayback = async () => {
    const audio = audioRef.current;
    if (!audio || played || playbackBlocked || anotherPartPlaying) return;
    updateStatus("starting");
    lastAllowedTimeRef.current = 0;
    audio.currentTime = 0;
    audio.playbackRate = 1;
    try {
      await audio.play();
      updateStatus("playing");
      // Consume the one play immediately so reload/re-entry cannot replay it.
      markPlayed(attemptId, partId);
      onPlaybackChange(partId, true);
    } catch {
      updateStatus("error");
    }
  };

  const finishPlayback = () => {
    updateStatus("finished");
    markPlayed(attemptId, partId);
    onPlaybackChange(partId, false);
    onEnded?.();
  };

  const handlePause = () => {
    const audio = audioRef.current;
    if (!audio || audio.ended) return;
    if (blockedRef.current) {
      updateStatus("finished");
      onPlaybackChange(partId, false);
      return;
    }
    if (statusRef.current !== "playing") return;
    void audio.play().catch(() => {
      updateStatus("finished");
      onPlaybackChange(partId, false);
    });
  };

  const handleSeeking = () => {
    const audio = audioRef.current;
    if (!audio || restoringSeekRef.current || statusRef.current !== "playing") return;
    restoringSeekRef.current = true;
    audio.currentTime = lastAllowedTimeRef.current;
    restoringSeekRef.current = false;
  };

  return (
    <section
      className="overflow-hidden rounded-3xl border border-outline-variant bg-surface-container shadow-token-card"
      aria-label={`${track.label} listening audio`}
    >
      <ListeningAudioHeader
        label={track.label}
        locked={locked}
        playing={status === "playing"}
      />

      <div className="relative min-h-60 bg-surface-container-low p-4 sm:min-h-64 sm:p-5">
        <div className="flex h-full min-h-52 items-center justify-center rounded-2xl border border-outline-variant bg-surface px-5 text-center sm:min-h-56">
          <ProductIcon
            name={locked ? "lock" : "radar"}
            size="xl"
            weight="duotone"
            className="text-on-surface-variant"
            aria-hidden="true"
          />
        </div>

        <ListeningAudioOverlay
          hydrated={hydrated}
          locked={locked}
          status={status}
          elapsedLabel={formatTime(elapsed)}
          durationLabel={duration > 0 ? formatTime(duration) : "—"}
          progress={progress}
          playbackBlocked={playbackBlocked}
          anotherPartPlaying={anotherPartPlaying}
          onPlay={() => void startPlayback()}
        />
      </div>

      <audio
        ref={(node) => {
          audioRef.current = node;
          node?.setAttribute("disablepictureinpicture", "");
        }}
        controls={false}
        controlsList="nodownload noplaybackrate noremoteplayback"
        preload="none"
        src={audioSrc}
        tabIndex={-1}
        onContextMenu={(event) => event.preventDefault()}
        onPlay={(event) => {
          if (statusRef.current === "starting" || statusRef.current === "playing") return;
          event.currentTarget.pause();
          event.currentTarget.currentTime = 0;
        }}
        onPause={handlePause}
        onSeeking={handleSeeking}
        onRateChange={(event) => {
          if (event.currentTarget.playbackRate !== 1) event.currentTarget.playbackRate = 1;
        }}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => {
          lastAllowedTimeRef.current = event.currentTarget.currentTime;
          setElapsed(event.currentTarget.currentTime);
        }}
        onEnded={finishPlayback}
      >
        <track kind="captions" />
      </audio>
    </section>
  );
}
