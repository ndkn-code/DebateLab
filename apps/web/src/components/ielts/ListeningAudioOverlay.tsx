"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ProductIcon } from "@/components/ui/product-icon";
import { transitions } from "@/lib/motion/variants";
import { ExamButton } from "./exam/ExamButton";

export type ListeningPlaybackStatus =
  | "gate"
  | "starting"
  | "playing"
  | "finished"
  | "error";

function HydratingOverlay() {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-inverse-surface/15 p-4 backdrop-blur-sm"
      initial={reducedMotion ? undefined : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reducedMotion ? undefined : { opacity: 0 }}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-surface text-primary shadow-token-card">
        <ProductIcon name="loader" size="md" weight="bold" className="animate-spin" />
      </span>
    </motion.div>
  );
}

function FinishedOverlay() {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-inverse-surface/15 p-4 backdrop-blur-sm"
      initial={reducedMotion ? undefined : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transitions.base}
    >
      <div className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface p-5 text-center shadow-token-panel sm:p-6">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-container-high text-on-surface">
          <ProductIcon name="lock" size="md" weight="duotone" />
        </span>
        <p className="mt-4 text-base font-extrabold text-on-surface">
          Recording finished — you cannot replay it.
        </p>
      </div>
    </motion.div>
  );
}

function PlayingOverlay({
  status,
  elapsedLabel,
  durationLabel,
  progress,
}: {
  status: ListeningPlaybackStatus;
  elapsedLabel: string;
  durationLabel: string;
  progress: number;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center p-5"
      initial={reducedMotion ? undefined : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transitions.base}
    >
      <div className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface/95 p-5 shadow-token-card backdrop-blur sm:p-6">
        <div className="flex items-center gap-3">
          <motion.span
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary"
            animate={reducedMotion ? undefined : { scale: [1, 1.04, 1] }}
            transition={reducedMotion ? undefined : { duration: 1.5, repeat: Infinity }}
          >
            <ProductIcon name="radar" size="md" weight="fill" />
          </motion.span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-on-surface">
              {status === "starting" ? "Starting recording…" : "Recording in progress"}
            </p>
            <p className="mt-1 text-xs font-semibold text-on-surface-variant">
              {elapsedLabel} / {durationLabel}
            </p>
          </div>
        </div>
        <div
          className="mt-5 h-1.5 overflow-hidden rounded-full bg-surface-container-high"
          role="progressbar"
          aria-label="Recording progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </motion.div>
  );
}

function GateOverlay({
  status,
  playbackBlocked,
  anotherPartPlaying,
  onPlay,
}: {
  status: ListeningPlaybackStatus;
  playbackBlocked: boolean;
  anotherPartPlaying: boolean;
  onPlay: () => void;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-inverse-surface/15 p-4 backdrop-blur-sm"
      initial={reducedMotion ? undefined : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reducedMotion ? undefined : { opacity: 0 }}
      transition={transitions.base}
    >
      <motion.div
        className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface p-5 text-center shadow-token-panel sm:p-6"
        initial={reducedMotion ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={transitions.soft}
      >
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-container text-primary">
          <ProductIcon name="lock" size="md" weight="duotone" />
        </span>
        <p className="mt-4 text-base font-extrabold text-on-surface">
          You will hear this recording ONCE.
        </p>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
          You cannot pause, rewind, or replay it. When you&apos;re ready, press Play.
        </p>
        {status === "error" ? (
          <p className="mt-3 text-sm font-semibold text-error" role="alert">
            The recording could not start. You can try once more.
          </p>
        ) : null}
        {anotherPartPlaying ? (
          <p className="mt-3 text-xs font-semibold text-on-surface-variant">
            Another recording is already playing.
          </p>
        ) : null}
        <ExamButton
          tone="primary"
          className="mx-auto mt-5 min-w-32"
          disabled={playbackBlocked || anotherPartPlaying}
          onClick={onPlay}
        >
          <ProductIcon name="play" size="sm" weight="fill" />
          Play
        </ExamButton>
      </motion.div>
    </motion.div>
  );
}

export function ListeningAudioHeader({
  label,
  locked,
  playing,
}: {
  label: string;
  locked: boolean;
  playing: boolean;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <div className="flex items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-container text-primary">
          <ProductIcon name={locked ? "lock" : "radar"} size="sm" weight="duotone" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Listening audio
          </p>
          <p className="truncate text-sm font-bold text-on-surface">{label}</p>
        </div>
      </div>
      {playing ? (
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-container px-3 py-1.5 text-xs font-bold text-primary">
          <motion.span
            className="size-2 rounded-full bg-primary"
            animate={reducedMotion ? undefined : { opacity: [0.4, 1, 0.4], scale: [0.9, 1.15, 0.9] }}
            transition={reducedMotion ? undefined : { duration: 1.4, repeat: Infinity }}
          />
          Now playing
        </span>
      ) : null}
    </div>
  );
}

export function ListeningAudioOverlay({
  hydrated,
  locked,
  status,
  elapsedLabel,
  durationLabel,
  progress,
  playbackBlocked,
  anotherPartPlaying,
  onPlay,
}: {
  hydrated: boolean;
  locked: boolean;
  status: ListeningPlaybackStatus;
  elapsedLabel: string;
  durationLabel: string;
  progress: number;
  playbackBlocked: boolean;
  anotherPartPlaying: boolean;
  onPlay: () => void;
}) {
  let content = (
    <GateOverlay
      status={status}
      playbackBlocked={playbackBlocked}
      anotherPartPlaying={anotherPartPlaying}
      onPlay={onPlay}
    />
  );
  if (!hydrated) content = <HydratingOverlay />;
  else if (locked) content = <FinishedOverlay />;
  else if (status === "playing" || status === "starting") {
    content = (
      <PlayingOverlay
        status={status}
        elapsedLabel={elapsedLabel}
        durationLabel={durationLabel}
        progress={progress}
      />
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={!hydrated ? "hydrating" : locked ? "finished" : status}>
        {content}
      </motion.div>
    </AnimatePresence>
  );
}

export function ListeningAudioUnavailable() {
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-outline-variant bg-surface-container p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        Listening audio
      </p>
      <p className="rounded-2xl bg-surface px-4 py-3 text-sm text-on-surface-variant">
        Audio is being prepared — this section is still sittable.
      </p>
    </section>
  );
}
