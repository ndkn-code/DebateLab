"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Square,
  AlertTriangle,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioVisualizer } from "./audio-visualizer";
import { MotionInfoPanel } from "./motion-info-panel";
import {
  PauseButton,
  PhasePill,
  PracticePanel,
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
  hasReceivedSpeech = false,
}: SpeakingPhaseProps) {
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showNoSpeechWarning, setShowNoSpeechWarning] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const noSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wordCount = transcript
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, interimTranscript]);

  // Show "no speech detected" warning after 5 seconds if no transcript
  useEffect(() => {
    if (hasReceivedSpeech || !isRecording || isPaused) {
      if (noSpeechTimerRef.current) {
        clearTimeout(noSpeechTimerRef.current);
        noSpeechTimerRef.current = null;
      }
      return;
    }

    noSpeechTimerRef.current = setTimeout(() => {
      if (!hasReceivedSpeech && isRecording && !isPaused) {
        setShowNoSpeechWarning(true);
      }
    }, 5000);

    return () => {
      if (noSpeechTimerRef.current) {
        clearTimeout(noSpeechTimerRef.current);
        noSpeechTimerRef.current = null;
      }
    };
  }, [hasReceivedSpeech, isRecording, isPaused]);

  const shouldShowNoSpeechWarning =
    showNoSpeechWarning && !speechError && !hasReceivedSpeech && isRecording && !isPaused;

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
      default:
        return "Speech recognition error. Attempting to recover...";
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col gap-6 px-5 pb-24 pt-6 sm:px-6 lg:px-8">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <MotionInfoPanel topic={topic} side={side} />

        <PracticePanel className="flex min-h-[330px] flex-col items-center justify-center p-5">
          <PhasePill tone="red">Speaking Phase</PhasePill>

          <div className="mt-5">
            <PracticeTimerDial
              timeLeft={timeLeft}
              totalTime={totalTime}
              progress={progress}
              tone="red"
              size="md"
            />
          </div>

          <div className="mt-4 flex flex-col items-center gap-3">
            <motion.div
              role="status"
              aria-label={isRecording ? "Microphone is recording" : isPaused ? "Recording is paused" : "Microphone is off"}
              className={cn(
                "relative flex h-20 w-20 items-center justify-center rounded-full",
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
                  "h-9 w-9",
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
                  ? "Listening..."
                  : "Waiting for speech..."
                : isPaused
                  ? "Paused"
              : "Not recording"}
            </span>
          </div>

          <div className="mt-4 w-full max-w-[330px]">
            <AudioVisualizer stream={audioStream} isRecording={isRecording} />
          </div>

          {speechError && (
            <div className="mt-6 flex items-center gap-2 rounded-2xl bg-warning/10 px-4 py-3 text-sm font-medium text-[#9b6b00]" role="alert">
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
              className="mt-6 flex items-center gap-2 rounded-2xl bg-surface-container px-4 py-3 text-sm font-medium text-on-surface-variant"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              No speech detected. Make sure you&apos;re speaking in English.
            </motion.div>
          )}
        </PracticePanel>
      </div>

      <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(300px,0.8fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <QuickNotesEditor
            value={prepNotes}
            onChange={onNotesChange}
            minHeightClassName="min-h-[285px]"
          />
        </div>

        <PracticePanel className="flex min-h-[285px] flex-1 flex-col p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-normal text-on-surface">
              Live Transcript
            </h2>
            <span className="text-sm font-medium text-on-surface-variant">
              {wordCount} words
            </span>
          </div>
          <div
            role="log"
            aria-label="Live speech transcript"
            aria-live="polite"
            className="min-h-[210px] flex-1 overflow-y-auto rounded-lg border border-outline-variant/80 bg-surface p-5"
          >
            {!transcript && !interimTranscript ? (
              <p className="text-base italic text-outline">
                Start speaking to see your transcript here...
              </p>
            ) : (
              <p className="font-serif text-[1.12rem] leading-8 text-on-surface">
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

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex flex-wrap items-center justify-center gap-4 px-4">
        <PauseButton
          isPaused={isPaused}
          onClick={isPaused ? onResume : onPause}
          className="pointer-events-auto"
        />
        <Button
          onClick={() => setShowEndConfirm(true)}
          aria-label="End speech early"
          className="pointer-events-auto h-14 min-w-[220px] gap-3 rounded-2xl bg-primary px-8 text-base font-semibold text-on-primary shadow-[inset_0_-4px_0_rgba(12,57,146,0.22),0_16px_28px_-18px_rgba(77,134,247,0.95)] hover:bg-primary-dim"
        >
          <Square className="h-5 w-5" />
          End Speech
        </Button>

        <AnimatePresence>
          {showEndConfirm && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-[520px] items-center justify-center rounded-[1.35rem] border border-outline-variant/70 bg-surface-container-lowest/95 p-4 shadow-[0_20px_55px_-48px_rgba(22,39,91,0.7)] backdrop-blur-xl"
            >
              <div className="text-center">
                <p className="mb-3 text-sm font-medium text-on-surface-variant">
                  End your speech early?
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowEndConfirm(false)}
                    variant="outline"
                    className="rounded-xl border-outline-variant/70 bg-surface text-on-surface-variant"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={onEnd}
                    className="rounded-xl bg-error text-on-error hover:bg-error-dim"
                  >
                    End Now
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
