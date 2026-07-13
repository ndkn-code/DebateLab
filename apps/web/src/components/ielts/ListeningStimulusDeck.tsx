"use client";

import { useCallback, useEffect, useState } from "react";
import type { MockPart } from "./mock-parts";
import { ListeningAudioPlayer } from "./ListeningAudioPlayer";

export function ListeningStimulusDeck({
  parts,
  activePartIndex,
  attemptId,
  playbackBlocked,
  onPlaybackActiveChange,
  onAudioEnded,
}: {
  parts: MockPart[];
  activePartIndex: number;
  attemptId: string;
  playbackBlocked: boolean;
  onPlaybackActiveChange: (active: boolean) => void;
  onAudioEnded: (partIndex: number) => void;
}) {
  const [playingPartId, setPlayingPartId] = useState<string | null>(null);
  const playingPartIndex = playingPartId
    ? parts.findIndex((candidate) => candidate.id === playingPartId)
    : -1;
  const visiblePartIndex = playingPartIndex >= 0 ? playingPartIndex : activePartIndex;

  useEffect(() => {
    onPlaybackActiveChange(playingPartId !== null);
  }, [onPlaybackActiveChange, playingPartId]);

  const handlePlaybackChange = useCallback((partId: string, playing: boolean) => {
    setPlayingPartId((current) => {
      if (playing) return partId;
      return current === partId ? null : current;
    });
  }, []);

  return parts.map((part, index) => (
    <div key={part.id} className={index === visiblePartIndex ? "block" : "hidden"}>
      {part.audio.length > 0 ? (
        <ListeningAudioPlayer
          tracks={part.audio}
          attemptId={attemptId}
          partId={part.id}
          playbackBlocked={playbackBlocked}
          anotherPartPlaying={playingPartId !== null && playingPartId !== part.id}
          onPlaybackChange={handlePlaybackChange}
          onEnded={() => onAudioEnded(index)}
        />
      ) : null}
    </div>
  ));
}
