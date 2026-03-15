"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Check, ArrowRight, ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MicCheckStatus =
  | "requesting"
  | "testing"
  | "success"
  | "denied"
  | "not-found"
  | "error";

interface MicCheckProps {
  onReady: (stream: MediaStream) => void;
  onBack: () => void;
}

const LEVEL_BAR_COUNT = 16;
const AUDIO_THRESHOLD = 0.05;
const AUDIO_CONFIRM_MS = 800;

export function MicCheck({ onReady, onBack }: MicCheckProps) {
  const [status, setStatus] = useState<MicCheckStatus>("requesting");
  const [errorMessage, setErrorMessage] = useState("");
  const [levels, setLevels] = useState<number[]>(new Array(LEVEL_BAR_COUNT).fill(0));
  const [audioDetected, setAudioDetected] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const aboveThresholdStartRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const stopStream = useCallback(() => {
    cleanup();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [cleanup]);

  const startAudioTest = useCallback((stream: MediaStream) => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);

      // Compute bars
      const step = Math.floor(dataArray.length / LEVEL_BAR_COUNT);
      const newLevels = Array.from({ length: LEVEL_BAR_COUNT }, (_, i) => {
        const value = dataArray[i * step] ?? 0;
        return value / 255;
      });
      setLevels(newLevels);

      // Compute average level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length / 255;

      if (avg > AUDIO_THRESHOLD) {
        if (!aboveThresholdStartRef.current) {
          aboveThresholdStartRef.current = Date.now();
        } else if (Date.now() - aboveThresholdStartRef.current >= AUDIO_CONFIRM_MS) {
          setAudioDetected(true);
        }
      } else {
        aboveThresholdStartRef.current = null;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const requestMic = useCallback(async () => {
    setStatus("requesting");
    setErrorMessage("");
    setAudioDetected(false);
    aboveThresholdStartRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;
      setStatus("testing");
      startAudioTest(stream);
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          setStatus("denied");
        } else if (err.name === "NotFoundError") {
          setStatus("not-found");
        } else {
          setStatus("error");
          setErrorMessage(err.message);
        }
      } else {
        setStatus("error");
        setErrorMessage("Failed to access microphone");
      }
    }
  }, [startAudioTest]);

  // Request mic on mount
  useEffect(() => {
    requestMic();
    return () => {
      // Only clean up analysis, NOT the stream — it might be passed to onReady
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount if we haven't handed off the stream
  useEffect(() => {
    return () => {
      cleanup();
      // If stream wasn't handed off, stop it
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cleanup]);

  const handleStart = () => {
    if (!streamRef.current) return;
    // Stop the analysis but keep the stream alive
    cleanup();
    const stream = streamRef.current;
    // Prevent unmount cleanup from killing the stream
    streamRef.current = null;
    onReady(stream);
  };

  const handleSkipTest = () => {
    if (!streamRef.current) return;
    cleanup();
    const stream = streamRef.current;
    streamRef.current = null;
    onReady(stream);
  };

  const handleTryAgain = () => {
    stopStream();
    requestMic();
  };

  const handleBack = () => {
    stopStream();
    onBack();
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-8 soft-shadow"
      >
        <AnimatePresence mode="wait">
          {/* Requesting Permission */}
          {status === "requesting" && (
            <motion.div
              key="requesting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-5 py-4"
            >
              <motion.div
                className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"
                animate={{
                  boxShadow: [
                    "0 0 0 0px rgba(47,79,221,0.2)",
                    "0 0 0 16px rgba(47,79,221,0)",
                  ],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Mic className="h-10 w-10 text-primary" />
              </motion.div>

              <div className="text-center">
                <h2 className="text-lg font-semibold text-on-surface">
                  Microphone Access Required
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Please allow microphone access when prompted by your browser.
                </p>
              </div>

              <div className="flex h-2 w-16 items-center justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-primary"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Testing Audio */}
          {status === "testing" && (
            <motion.div
              key="testing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-5 py-4"
            >
              <motion.div
                className={cn(
                  "flex h-20 w-20 items-center justify-center rounded-full transition-colors",
                  audioDetected ? "bg-emerald-500/10" : "bg-primary/10"
                )}
                animate={
                  audioDetected
                    ? {}
                    : {
                        boxShadow: [
                          "0 0 0 0px rgba(47,79,221,0.15)",
                          "0 0 0 12px rgba(47,79,221,0)",
                        ],
                      }
                }
                transition={
                  audioDetected ? {} : { duration: 1.5, repeat: Infinity }
                }
              >
                {audioDetected ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                  >
                    <Check className="h-10 w-10 text-emerald-500" />
                  </motion.div>
                ) : (
                  <Mic className="h-10 w-10 text-primary" />
                )}
              </motion.div>

              <div className="text-center">
                <h2 className="text-lg font-semibold text-on-surface">
                  {audioDetected
                    ? "Microphone is working!"
                    : "Test Your Microphone"}
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  {audioDetected
                    ? "Audio input detected. You're ready to begin."
                    : "Speak something to test your microphone..."}
                </p>
              </div>

              {/* Audio level bars */}
              <div className="flex h-12 items-end justify-center gap-1">
                {levels.map((level, i) => (
                  <motion.div
                    key={i}
                    className={cn(
                      "w-2 rounded-full transition-colors",
                      audioDetected ? "bg-emerald-500" : "bg-primary"
                    )}
                    style={{
                      height: `${Math.max(4, level * 48)}px`,
                      opacity: 0.3 + level * 0.7,
                    }}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className="flex w-full flex-col items-center gap-3 pt-2">
                <Button
                  onClick={handleStart}
                  disabled={!audioDetected}
                  className={cn(
                    "w-full gap-2 py-6 text-base font-semibold",
                    audioDetected
                      ? "bg-primary text-on-primary hover:bg-primary/90"
                      : "cursor-not-allowed bg-primary/40 text-on-primary/60"
                  )}
                >
                  Start Session
                  <ArrowRight className="h-5 w-5" />
                </Button>

                {!audioDetected && (
                  <button
                    onClick={handleSkipTest}
                    className="text-xs text-on-surface-variant transition-colors hover:text-on-surface"
                  >
                    Skip audio test
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Permission Denied */}
          {status === "denied" && (
            <motion.div
              key="denied"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-5 py-4"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
                <MicOff className="h-10 w-10 text-red-400" />
              </div>

              <div className="text-center">
                <h2 className="text-lg font-semibold text-on-surface">
                  Microphone Access Denied
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Follow these steps to enable your microphone:
                </p>
              </div>

              <ol className="w-full space-y-2 rounded-xl border border-outline-variant/10 bg-surface-container-low p-4 text-sm text-on-surface-variant">
                <li className="flex gap-2">
                  <span className="shrink-0 font-semibold text-on-surface">1.</span>
                  Click the lock/camera icon in your browser&apos;s address bar
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-semibold text-on-surface">2.</span>
                  Find &quot;Microphone&quot; and change it to &quot;Allow&quot;
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-semibold text-on-surface">3.</span>
                  Reload the page and try again
                </li>
              </ol>

              <div className="flex w-full gap-3">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="flex-1 gap-2 border-outline-variant/30 bg-transparent text-on-surface-variant"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Go Back
                </Button>
                <Button
                  onClick={handleTryAgain}
                  className="flex-1 gap-2 bg-primary text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                  Try Again
                </Button>
              </div>
            </motion.div>
          )}

          {/* No Microphone Found */}
          {status === "not-found" && (
            <motion.div
              key="not-found"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-5 py-4"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
                <MicOff className="h-10 w-10 text-red-400" />
              </div>

              <div className="text-center">
                <h2 className="text-lg font-semibold text-on-surface">
                  No Microphone Detected
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Please connect a microphone and try again.
                </p>
              </div>

              <div className="flex w-full gap-3">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="flex-1 gap-2 border-outline-variant/30 bg-transparent text-on-surface-variant"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Go Back
                </Button>
                <Button
                  onClick={handleTryAgain}
                  className="flex-1 gap-2 bg-primary text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                  Try Again
                </Button>
              </div>
            </motion.div>
          )}

          {/* Generic Error */}
          {status === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-5 py-4"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
                <MicOff className="h-10 w-10 text-red-400" />
              </div>

              <div className="text-center">
                <h2 className="text-lg font-semibold text-on-surface">
                  Microphone Error
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  {errorMessage || "An unexpected error occurred."}
                </p>
              </div>

              <div className="flex w-full gap-3">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="flex-1 gap-2 border-outline-variant/30 bg-transparent text-on-surface-variant"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Go Back
                </Button>
                <Button
                  onClick={handleTryAgain}
                  className="flex-1 gap-2 bg-primary text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                  Try Again
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
