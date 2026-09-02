"use client";

/**
 * Replayable audio clip with exam-styled controls: play/pause, a keyboard
 * seekable progress slider, elapsed/duration, and optional labelled markers
 * (e.g. speaking parts, review highlights). The native `<audio>` is hidden —
 * no `controls` — so every surface shows the same chrome.
 *
 * Not for the one-shot Listening recording (see ListeningAudioPlayer); this is
 * for speaking prompts, results playback, and review.
 */
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { ProductIcon } from "@/components/ui/product-icon";
import { formatTime } from "@/lib/ielts/audio/format-time";
import { cn } from "@/lib/utils";
import { ExamButton } from "./ExamButton";

const SEEK_STEP_SECONDS = 5;

export interface AudioClipMarker {
  seconds: number;
  label: string;
}

export interface AudioClipPlayerProps {
  src: string;
  /** Accessible name of the clip (also the slider label). */
  title: string;
  markers?: AudioClipMarker[];
  onEnded?: () => void;
  className?: string;
}

export function AudioClipPlayer({
  src,
  title,
  markers = [],
  onEnded,
  className,
}: AudioClipPlayerProps) {
  const t = useTranslations("dashboard.practice.tts");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const scrubbingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  const progress = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    const clamped = Math.min(Math.max(0, seconds), duration || 0);
    audio.currentTime = clamped;
    setElapsed(clamped);
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  };

  const secondsFromPointer = (clientX: number): number | null => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || duration <= 0) return null;
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return fraction * duration;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    scrubbingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const seconds = secondsFromPointer(event.clientX);
    if (seconds !== null) seekTo(seconds);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return;
    const seconds = secondsFromPointer(event.clientX);
    if (seconds !== null) seekTo(seconds);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    scrubbingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const actions: Record<string, () => void> = {
      ArrowLeft: () => seekTo(elapsed - SEEK_STEP_SECONDS),
      ArrowDown: () => seekTo(elapsed - SEEK_STEP_SECONDS),
      ArrowRight: () => seekTo(elapsed + SEEK_STEP_SECONDS),
      ArrowUp: () => seekTo(elapsed + SEEK_STEP_SECONDS),
      Home: () => seekTo(0),
      End: () => seekTo(duration),
      " ": toggle,
      Enter: toggle,
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-outline-variant bg-surface-container-low p-3",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <ExamButton
          data-exam-control
          tone="primary"
          onClick={toggle}
          aria-label={playing ? t("pause") : t("play")}
          aria-pressed={playing}
          className="size-10 px-0"
        >
          <ProductIcon name={playing ? "pause" : "play"} size="sm" weight="fill" aria-hidden="true" />
        </ExamButton>
        <div className="min-w-0 flex-1">
          <p className="truncate type-label font-bold text-on-surface">{title}</p>
          <p className="type-caption tabular-nums text-on-surface-variant">
            {formatTime(elapsed)} / {duration > 0 ? formatTime(duration) : "—"}
          </p>
        </div>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(elapsed)}
        aria-valuetext={`${formatTime(elapsed)} / ${formatTime(duration)}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={handleKeyDown}
        className="relative h-6 cursor-pointer touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
      >
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-surface-container-high">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        {duration > 0
          ? markers.map((marker) => (
              <span
                key={`${marker.seconds}-${marker.label}`}
                aria-hidden="true"
                title={marker.label}
                className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-on-surface-variant"
                style={{ left: `${Math.min(100, Math.max(0, (marker.seconds / duration) * 100))}%` }}
              />
            ))
          : null}
        <span
          aria-hidden="true"
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-surface"
          style={{ left: `${progress}%` }}
        />
      </div>

      {markers.length > 0 ? (
        <ol className="flex flex-wrap gap-1.5">
          {markers.map((marker) => (
            <li key={`${marker.seconds}-${marker.label}`}>
              <button
                type="button"
                data-exam-control
                onClick={() => seekTo(marker.seconds)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-2.5 type-caption font-semibold text-on-surface-variant transition hover:border-primary hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="tabular-nums">{formatTime(marker.seconds)}</span>
                {marker.label}
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        tabIndex={-1}
        controlsList="nodownload"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => {
          if (!scrubbingRef.current) setElapsed(event.currentTarget.currentTime);
        }}
        onEnded={() => {
          setPlaying(false);
          onEnded?.();
        }}
      >
        <track kind="captions" />
      </audio>
    </div>
  );
}
