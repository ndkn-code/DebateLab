"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Pause,
  Square,
  ChevronDown,
  AlertTriangle,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CountdownTimer } from "./countdown-timer";
import { AudioVisualizer } from "./audio-visualizer";
import { cn } from "@/lib/utils";

interface SpeakingPhaseProps {
  timeLeft: number;
  totalTime: number;
  progress: number;
  isRunning: boolean;
  isRecording: boolean;
  transcript: string;
  interimTranscript: string;
  prepNotes: string;
  audioStream: MediaStream | null;
  speechError: string | null;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  isPaused: boolean;
  hasReceivedSpeech?: boolean;
}

export function SpeakingPhase({
  timeLeft,
  totalTime,
  progress,
  isRunning,
  isRecording,
  transcript,
  interimTranscript,
  prepNotes,
  audioStream,
  speechError,
  onPause,
  onResume,
  onEnd,
  isPaused,
  hasReceivedSpeech = false,
}: SpeakingPhaseProps) {
  const [showNotes, setShowNotes] = useState(false);
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
      setShowNoSpeechWarning(false);
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
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      {/* Phase label */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <span className="rounded-full bg-red-500/10 px-4 py-1.5 text-sm font-medium text-red-400">
          Speaking Phase
        </span>
      </motion.div>

      {/* Timer */}
      <div className="flex justify-center">
        <CountdownTimer
          timeLeft={timeLeft}
          totalTime={totalTime}
          progress={progress}
          isRunning={isRunning}
        />
      </div>

      {/* Mic Status */}
      <div className="flex flex-col items-center gap-3">
        <motion.div
          role="status"
          aria-label={isRecording ? "Microphone is recording" : isPaused ? "Recording is paused" : "Microphone is off"}
          className={cn(
            "relative flex h-16 w-16 items-center justify-center rounded-full",
            isRecording
              ? "bg-red-500/20"
              : isPaused
                ? "bg-amber-500/20"
                : "bg-surface-container-high"
          )}
          animate={
            isRecording
              ? {
                  boxShadow: [
                    "0 0 0 0px rgba(239,68,68,0.3)",
                    "0 0 0 12px rgba(239,68,68,0)",
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
              "h-7 w-7",
              isRecording
                ? "text-red-400"
                : isPaused
                  ? "text-amber-400"
                  : "text-outline-variant"
            )}
          />
        </motion.div>
        <span className="text-xs font-medium text-on-surface-variant">
          {isRecording
            ? hasReceivedSpeech
              ? "Listening..."
              : "Waiting for speech..."
            : isPaused
              ? "Paused"
              : "Not recording"}
        </span>
      </div>

      {/* Audio Visualizer */}
      <AudioVisualizer stream={audioStream} isRecording={isRecording} />

      {/* Speech error banner */}
      {speechError && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-4 py-2 text-sm text-amber-400" role="alert">
          {speechError === "network" ? (
            <WifiOff className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          {getErrorMessage(speechError)}
        </div>
      )}

      {/* No speech detected warning */}
      {showNoSpeechWarning && !speechError && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-lg bg-surface-container-high/50 px-4 py-2 text-sm text-on-surface-variant"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-outline-variant" />
          No speech detected. Make sure you&apos;re speaking in English.
        </motion.div>
      )}

      {/* Transcript */}
      <div className="relative flex-1">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-on-surface-variant">
            Live Transcript
          </span>
          <span className="text-xs text-outline">{wordCount} words</span>
        </div>
        <div role="log" aria-label="Live speech transcript" aria-live="polite" className="h-48 overflow-y-auto rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 sm:h-56">
          {!transcript && !interimTranscript ? (
            <p className="text-sm italic text-outline-variant">
              Start speaking to see your transcript here...
            </p>
          ) : (
            <p className="font-serif text-[15px] leading-relaxed">
              <span className="text-on-surface">{transcript}</span>
              {interimTranscript && (
                <span className="italic text-on-surface-variant">
                  {interimTranscript}
                </span>
              )}
            </p>
          )}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      {/* Notes peek */}
      {prepNotes && (
        <div>
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="flex items-center gap-1.5 text-xs text-on-surface-variant transition-colors hover:text-on-surface-variant"
          >
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                showNotes && "rotate-180"
              )}
            />
            {showNotes ? "Hide Notes" : "View Notes"}
          </button>
          <AnimatePresence>
            {showNotes && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3 text-xs text-on-surface-variant">
                  {prepNotes}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Controls */}
      <div className="sticky bottom-4 flex items-center justify-center gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-lowest/95 p-3 backdrop-blur-xl">
        <Button
          onClick={isPaused ? onResume : onPause}
          aria-label={isPaused ? "Resume recording" : "Pause recording"}
          variant="outline"
          className="gap-2 border-outline-variant/30 bg-transparent text-on-surface-variant hover:bg-surface-container-high"
        >
          {isPaused ? (
            <>
              <Mic className="h-4 w-4" />
              Resume
            </>
          ) : (
            <>
              <Pause className="h-4 w-4" />
              Pause
            </>
          )}
        </Button>
        <Button
          onClick={() => setShowEndConfirm(true)}
          aria-label="End speech early"
          variant="outline"
          className="gap-2 border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
        >
          <Square className="h-4 w-4" />
          End Speech
        </Button>

        {/* End confirmation dialog */}
        <AnimatePresence>
          {showEndConfirm && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 flex items-center justify-center rounded-xl bg-surface-container-lowest/95 backdrop-blur-xl"
            >
              <div className="text-center">
                <p className="mb-3 text-sm text-on-surface-variant">
                  End your speech early?
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowEndConfirm(false)}
                    variant="outline"
                    className="border-outline-variant/30 bg-transparent text-on-surface-variant"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={onEnd}
                    className="bg-red-500/20 text-red-400 hover:bg-red-500/30"
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
