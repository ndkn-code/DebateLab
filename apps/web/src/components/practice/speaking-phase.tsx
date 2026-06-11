"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpenText,
  Clock3,
  Mic,
  Square,
  AlertTriangle,
  WifiOff,
} from "@/components/ui/icons";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AudioVisualizer } from "./audio-visualizer";
import { MotionInfoPanel } from "./motion-info-panel";
import { RoundTranscriptTabs } from "./round-transcript-tabs";
import {
  ActionRail,
  PauseButton,
  PhasePill,
  PracticePanel,
  formatPracticeTime,
  PracticeTimerDial,
  QuickNotesEditor,
} from "./practice-session-ui";
import { cn } from "@/lib/utils";
import type { DebateRound, DebateTopic } from "@/types";

interface SpeakingPhaseProps {
  topic: DebateTopic;
  side: "proposition" | "opposition";
  timeLeft: number;
  totalTime: number;
  progress: number;
  isRunning: boolean;
  isRecording: boolean;
  transcript: string;
  interimTranscript: string;
  prepNotes: string;
  onNotesChange: (notes: string) => void;
  audioStream: MediaStream | null;
  speechError: string | null;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  isPaused: boolean;
  hasDetectedAudio?: boolean;
  hasReceivedSpeech?: boolean;
  showcaseEndConfirm?: boolean;
  /** Full-round mode: enables the per-round transcript tabs. */
  rounds?: DebateRound[];
  currentRound?: number;
}

export function SpeakingPhase({
  topic,
  side,
  timeLeft,
  totalTime,
  progress,
  isRecording,
  transcript,
  interimTranscript,
  prepNotes,
  onNotesChange,
  audioStream,
  speechError,
  onPause,
  onResume,
  onEnd,
  isPaused,
  hasDetectedAudio = false,
  hasReceivedSpeech = false,
  showcaseEndConfirm = false,
  rounds,
  currentRound,
}: SpeakingPhaseProps) {
  const t = useTranslations("dashboard.practice");
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showNoSpeechWarning, setShowNoSpeechWarning] = useState(false);
  const [showBriefUtility, setShowBriefUtility] = useState(false);
  const noSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noSpeechResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const hasHeardAudio = hasDetectedAudio || hasReceivedSpeech;
  const shouldShowEndConfirm = showcaseEndConfirm || showEndConfirm;

  // Show "no speech detected" only when neither local audio nor transcript has arrived.
  useEffect(() => {
    if (hasHeardAudio || !isRecording || isPaused) {
      if (noSpeechTimerRef.current) {
        clearTimeout(noSpeechTimerRef.current);
        noSpeechTimerRef.current = null;
      }
      if (noSpeechResetTimerRef.current) {
        clearTimeout(noSpeechResetTimerRef.current);
      }
      noSpeechResetTimerRef.current = setTimeout(() => {
        setShowNoSpeechWarning(false);
        noSpeechResetTimerRef.current = null;
      }, 0);
      return;
    }

    noSpeechTimerRef.current = setTimeout(() => {
      if (!hasHeardAudio && isRecording && !isPaused) {
        setShowNoSpeechWarning(true);
      }
    }, 9000);

    return () => {
      if (noSpeechTimerRef.current) {
        clearTimeout(noSpeechTimerRef.current);
        noSpeechTimerRef.current = null;
      }
      if (noSpeechResetTimerRef.current) {
        clearTimeout(noSpeechResetTimerRef.current);
        noSpeechResetTimerRef.current = null;
      }
    };
  }, [hasHeardAudio, isRecording, isPaused]);

  const shouldShowNoSpeechWarning =
    showNoSpeechWarning &&
    !speechError &&
    !hasHeardAudio &&
    isRecording &&
    !isPaused;

  const handleConfirmEnd = () => {
    if (!showcaseEndConfirm) {
      setShowEndConfirm(false);
    }
    onEnd();
  };

  function getErrorMessage(error: string): string {
    switch (error) {
      case "not-allowed":
        return "Microphone access denied. Please enable it in your browser settings and reload.";
      case "audio-capture":
        return "No microphone detected. Please connect a microphone and reload.";
      case "network":
        return "Speech recognition requires an internet connection. Check your network.";
      case "reconnecting":
        return "Reconnecting speech recognition...";
      case "token-unauthorized":
        return "Please sign in again to start speech recognition.";
      case "token-rate-limited":
        return "Speech recognition is reconnecting too often. Please wait a moment and try again.";
      case "token-service-misconfigured":
        return "Speech recognition is not configured correctly. Please contact support.";
      case "token-service":
        return "Speech recognition is temporarily unavailable. Please try again later.";
      default:
        return "Speech recognition error. Attempting to recover...";
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 px-4 pb-20 pt-3 sm:px-5 lg:px-6">
      <div className="fixed bottom-24 right-3 z-40 flex flex-col items-end gap-2 lg:bottom-auto lg:right-5 lg:top-28">
        <div className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white/95 px-3 py-2 text-sm font-bold text-on-surface-variant shadow-token-card backdrop-blur">
          <Clock3 className="h-4 w-4 text-primary" />
          <span className="tabular-nums">{formatPracticeTime(timeLeft)}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowBriefUtility((value) => !value)}
          aria-label={
            showBriefUtility
              ? t("session.hide_motion_brief")
              : t("session.show_motion_brief")
          }
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-outline-variant bg-white/95 text-primary shadow-token-card backdrop-blur transition hover:bg-surface-container"
        >
          <BookOpenText className="h-5 w-5" />
        </button>
      </div>

      <AnimatePresence>
        {showBriefUtility && (
          <motion.div
            initial={{ opacity: 0, x: 10, y: 8 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 10, y: 8 }}
            className="fixed bottom-24 right-16 z-40 max-h-[62vh] w-[min(88vw,440px)] overflow-y-auto lg:bottom-auto lg:right-20 lg:top-28"
          >
            <MotionInfoPanel
              topic={topic}
              side={side}
              className="shadow-token-card"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_296px]">
        <MotionInfoPanel topic={topic} side={side} />

        <PracticePanel className="flex min-h-[260px] flex-col items-center justify-center p-4">
          <PhasePill tone="red">{t("session.speaking_phase")}</PhasePill>

          <div className="mt-3">
            <PracticeTimerDial
              timeLeft={timeLeft}
              totalTime={totalTime}
              progress={progress}
              tone="red"
              size="md"
            />
          </div>

          <div className="mt-3 flex flex-col items-center gap-2">
            <motion.div
              role="status"
              aria-label={isRecording ? "Microphone is recording" : isPaused ? "Recording is paused" : "Microphone is off"}
              className={cn(
                "relative flex h-14 w-14 items-center justify-center rounded-full",
                isRecording
                  ? "bg-error-container"
                  : isPaused
                    ? "bg-warning/15"
                    : "bg-surface-container-high"
              )}
              animate={
                isRecording
                  ? {
                      boxShadow: [
                        "0 0 0 0px rgba(255,75,75,0.26)",
                        "0 0 0 16px rgba(255,75,75,0)",
                      ],
                    }
                  : {}
              }
              transition={
                isRecording ? { duration: 1.5, repeat: Infinity } : {}
              }
              >
                <Mic
                  className={cn(
                  "h-6 w-6",
                  isRecording
                    ? "text-error"
                    : isPaused
                      ? "text-warning"
                      : "text-outline"
                )}
              />
            </motion.div>
            <span className="text-sm font-semibold text-on-surface">
              {isRecording
                ? hasReceivedSpeech
                  ? t("session.listening")
                  : hasDetectedAudio
                    ? t("session.waiting_for_transcript")
                  : t("session.waiting_for_speech")
                : isPaused
                  ? t("session.paused")
              : t("session.not_recording")}
            </span>
          </div>

          <div className="mt-3 w-full max-w-[240px]">
            <AudioVisualizer stream={audioStream} isRecording={isRecording} />
          </div>

          {speechError && (
            <div className="mt-4 flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm font-medium text-on-surface-variant" role="alert">
              {speechError === "network" ? (
                <WifiOff className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              {getErrorMessage(speechError)}
            </div>
          )}

          {shouldShowNoSpeechWarning && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 rounded-md bg-surface-container px-3 py-2 text-sm font-medium text-on-surface-variant"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              {t("session.no_speech_detected")}
            </motion.div>
          )}
        </PracticePanel>
      </div>

      <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <QuickNotesEditor
            value={prepNotes}
            onChange={onNotesChange}
            minHeightClassName="min-h-[220px]"
          />
        </div>

        <RoundTranscriptTabs
          rounds={rounds}
          currentRound={currentRound}
          liveTranscript={transcript}
          interimTranscript={interimTranscript}
        />
      </div>

      <ActionRail className={cn("mx-auto w-fit", shouldShowEndConfirm && "invisible")}>
        <PauseButton
          isPaused={isPaused}
          onClick={isPaused ? onResume : onPause}
        />
        <Button
          onClick={() => setShowEndConfirm(true)}
          aria-label="End speech early"
          className="h-11 min-w-[172px] gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-on-primary shadow-token-primary hover:bg-primary-dim"
        >
          <Square className="h-4 w-4" />
          {t("session.end_speech")}
        </Button>
      </ActionRail>

      <AnimatePresence>
        {shouldShowEndConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-on-surface/10 px-4 pb-4 backdrop-blur-[1px] sm:pb-6"
            onClick={() => setShowEndConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="end-speech-confirm-title"
              onClick={(event) => event.stopPropagation()}
              className="pointer-events-auto mx-auto flex w-full max-w-[520px] items-center justify-center rounded-[1.35rem] border border-outline-variant/70 bg-surface-container-lowest/95 p-4 shadow-token-card backdrop-blur-xl"
            >
              <div className="text-center">
                <p
                  id="end-speech-confirm-title"
                  className="mb-3 text-sm font-medium text-on-surface-variant"
                >
                  {t("session.end_confirm_title")}
                </p>
                <div className="flex justify-center gap-2">
                  <Button
                    onClick={() => setShowEndConfirm(false)}
                    variant="outline"
                    className="rounded-xl border-outline-variant/70 bg-surface text-on-surface-variant"
                  >
                    {t("session.cancel")}
                  </Button>
                  <Button
                    onClick={handleConfirmEnd}
                    className="rounded-xl bg-primary text-on-primary shadow-token-primary hover:bg-primary-dim"
                  >
                    {t("session.end_now")}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
