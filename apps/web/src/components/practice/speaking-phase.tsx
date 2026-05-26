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
import type { DebateTopic } from "@/types";

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
}: SpeakingPhaseProps) {
  const t = useTranslations("dashboard.practice");
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showNoSpeechWarning, setShowNoSpeechWarning] = useState(false);
  const [showBriefUtility, setShowBriefUtility] = useState(false);
  const transcriptPaneRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollTranscriptRef = useRef(true);
  const noSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noSpeechResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const wordCount = transcript
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  const hasHeardAudio = hasDetectedAudio || hasReceivedSpeech;

  const handleTranscriptScroll = () => {
    const pane = transcriptPaneRef.current;
    if (!pane) return;

    const distanceFromBottom =
      pane.scrollHeight - pane.scrollTop - pane.clientHeight;
    shouldAutoScrollTranscriptRef.current = distanceFromBottom < 56;
  };

  useEffect(() => {
    const pane = transcriptPaneRef.current;
    if (!pane || !shouldAutoScrollTranscriptRef.current) return;

    pane.scrollTo({
      top: pane.scrollHeight,
      behavior: "smooth",
    });
  }, [transcript, interimTranscript]);

  useEffect(() => {
    if (isRecording && !isPaused && !transcript && !interimTranscript) {
      shouldAutoScrollTranscriptRef.current = true;
    }
  }, [interimTranscript, isPaused, isRecording, transcript]);

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
    setShowEndConfirm(false);
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
        <div className="inline-flex items-center gap-2 rounded-xl border border-[#D8E5FF] bg-white/95 px-3 py-2 text-sm font-bold text-[#071159] shadow-[0_18px_42px_-28px_rgba(22,39,91,0.45)] backdrop-blur">
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
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#D8E5FF] bg-white/95 text-primary shadow-[0_18px_42px_-28px_rgba(22,39,91,0.45)] backdrop-blur transition hover:bg-[#F4F8FF]"
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
              className="shadow-[0_22px_62px_-34px_rgba(22,39,91,0.58)]"
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
                        "0 0 0 0px rgba(239,106,106,0.26)",
                        "0 0 0 16px rgba(239,106,106,0)",
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
            <div className="mt-4 flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm font-medium text-[#9b6b00]" role="alert">
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

        <PracticePanel className="flex min-h-[220px] flex-1 flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-normal text-on-surface">
              {t("session.live_transcript")}
            </h2>
            <span className="text-sm font-medium text-on-surface-variant">
              {t("session.word_count", { count: wordCount })}
            </span>
          </div>
          <div
            ref={transcriptPaneRef}
            role="log"
            aria-label="Live speech transcript"
            aria-live="polite"
            onScroll={handleTranscriptScroll}
            className="min-h-[162px] flex-1 overflow-y-auto rounded-lg border border-outline-variant/80 bg-surface p-4"
          >
            {!transcript && !interimTranscript ? (
              <p className="text-sm italic text-outline">
                {t("session.transcript_placeholder")}
              </p>
            ) : (
              <p className="font-sans text-base leading-7 text-on-surface">
                <span>{transcript}</span>
                {interimTranscript && (
                  <span className="italic text-on-surface-variant">
                    {interimTranscript}
                  </span>
                )}
              </p>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </PracticePanel>
      </div>

      <ActionRail className={cn("mx-auto w-fit", showEndConfirm && "invisible")}>
        <PauseButton
          isPaused={isPaused}
          onClick={isPaused ? onResume : onPause}
        />
        <Button
          onClick={() => setShowEndConfirm(true)}
          aria-label="End speech early"
          className="h-11 min-w-[172px] gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-on-primary shadow-[inset_0_-2px_0_rgba(12,57,146,0.22),0_12px_22px_-16px_rgba(77,134,247,0.95)] hover:bg-primary-dim"
        >
          <Square className="h-4 w-4" />
          {t("session.end_speech")}
        </Button>
      </ActionRail>

      <AnimatePresence>
        {showEndConfirm && (
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
              className="pointer-events-auto mx-auto flex w-full max-w-[520px] items-center justify-center rounded-[1.35rem] border border-outline-variant/70 bg-surface-container-lowest/95 p-4 shadow-[0_20px_55px_-42px_rgba(22,39,91,0.75)] backdrop-blur-xl"
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
                    className="rounded-xl bg-primary text-on-primary shadow-[inset_0_-3px_0_rgba(12,57,146,0.22),0_12px_24px_-16px_rgba(77,134,247,0.95)] hover:bg-primary-dim"
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
