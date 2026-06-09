"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Check, ArrowRight, ArrowLeft, RotateCcw } from "@/components/ui/icons";
import { useTranslations } from "next-intl";
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
  showcaseStatus?: MicCheckStatus;
  showcaseAudioDetected?: boolean;
  showcaseLevels?: number[];
}

const LEVEL_BAR_COUNT = 16;
const AUDIO_THRESHOLD = 0.05;
const AUDIO_CONFIRM_MS = 800;

export function MicCheck({
  onReady,
  onBack,
  showcaseStatus,
  showcaseAudioDetected,
  showcaseLevels,
}: MicCheckProps) {
  const t = useTranslations("dashboard.practice");
  const [status, setStatus] = useState<MicCheckStatus>(
    showcaseStatus ?? "requesting"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [levels, setLevels] = useState<number[]>(
    showcaseLevels ?? new Array(LEVEL_BAR_COUNT).fill(0)
  );
  const [audioDetected, setAudioDetected] = useState(false);
  const resolvedAudioDetected =
    showcaseStatus === "testing"
      ? showcaseAudioDetected ?? true
      : audioDetected;
  const resolvedLevels =
    showcaseStatus === "testing" && showcaseLevels ? showcaseLevels : levels;

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
    if (showcaseStatus) return;
    requestMic();
    return () => {
      // Only clean up analysis, NOT the stream — it might be passed to onReady
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showcaseStatus) return;
    setStatus(showcaseStatus);
    if (showcaseLevels) setLevels(showcaseLevels);
    setAudioDetected(showcaseAudioDetected ?? showcaseStatus === "testing");
  }, [showcaseAudioDetected, showcaseLevels, showcaseStatus]);

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
    if (showcaseStatus) return;
    if (!streamRef.current) return;
    // Stop the analysis but keep the stream alive
    cleanup();
    const stream = streamRef.current;
    // Prevent unmount cleanup from killing the stream
    streamRef.current = null;
    onReady(stream);
  };

  const handleSkipTest = () => {
    if (showcaseStatus) return;
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
    <div className="flex flex-1 items-center justify-center px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        <AnimatePresence mode="wait">
          {/* Requesting Permission */}
          {status === "requesting" && (
            <motion.div
              key="requesting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-5 py-4 text-center"
            >
              <motion.div
                className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-container"
                animate={{
                  boxShadow: [
                    "0 0 0 0px rgba(0,184,217,0.2)",
                    "0 0 0 16px rgba(0,184,217,0)",
                  ],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Mic className="h-9 w-9 text-primary" />
              </motion.div>

              <div>
                <h2 className="text-2xl font-semibold tracking-normal text-on-surface">
                  {t("session.mic_access_required")}
                </h2>
                <p className="mt-3 text-sm font-medium text-on-surface-variant">
                  {t("session.mic_allow_prompt")}
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
              className="flex flex-col items-center gap-5 py-4 text-center"
            >
              <motion.div
                className={cn(
                  "flex h-24 w-24 items-center justify-center rounded-full transition-colors",
                  resolvedAudioDetected
                    ? "bg-secondary-container/80"
                    : "bg-primary-container"
                )}
                animate={
                  resolvedAudioDetected
                    ? {}
                    : {
                        boxShadow: [
                          "0 0 0 0px rgba(0,184,217,0.15)",
                          "0 0 0 12px rgba(0,184,217,0)",
                        ],
                      }
                }
                transition={
                  resolvedAudioDetected
                    ? {}
                    : { duration: 1.5, repeat: Infinity }
                }
              >
                {resolvedAudioDetected ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                  >
                    <Check className="h-10 w-10 text-secondary-dim" />
                  </motion.div>
                ) : (
                  <Mic className="h-10 w-10 text-primary" />
                )}
              </motion.div>

              <div>
                <h2 className="text-2xl font-semibold tracking-normal text-on-surface">
                  {resolvedAudioDetected
                    ? t("session.mic_working")
                    : t("session.test_microphone")}
                </h2>
                <p className="mt-3 text-sm font-medium text-on-surface-variant">
                  {resolvedAudioDetected
                    ? t("session.mic_detected")
                    : t("session.speak_to_test_mic")}
                </p>
              </div>

              <div className="flex h-12 items-end justify-center gap-1.5">
                {resolvedLevels.map((level, i) => (
                  <motion.div
                    key={i}
                    className={cn(
                      "w-2.5 rounded-full transition-colors",
                      resolvedAudioDetected ? "bg-secondary" : "bg-primary"
                    )}
                    style={{
                      height: `${Math.max(4, level * 40)}px`,
                      opacity: 0.3 + level * 0.7,
                    }}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className="flex w-full flex-col items-center gap-3 pt-2">
                <Button
                  onClick={handleStart}
                  disabled={!resolvedAudioDetected}
                  className={cn(
                    "h-11 w-full max-w-[300px] gap-2 rounded-lg text-sm font-semibold",
                    resolvedAudioDetected
                      ? "bg-primary text-on-primary hover:bg-primary/90"
                      : "cursor-not-allowed bg-primary/40 text-on-primary/60"
                  )}
                >
                  {t("session.start_session")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>

                {!resolvedAudioDetected && (
                  <button
                    onClick={handleSkipTest}
                    className="text-xs text-on-surface-variant transition-colors hover:text-on-surface"
                  >
                    {t("session.skip_audio_test")}
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
              className="mx-auto flex max-w-md flex-col items-center gap-5 rounded-3xl border border-outline-variant/50 bg-surface-container-lowest p-8 text-center shadow-token-card"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
                <MicOff className="h-10 w-10 text-red-400" />
              </div>

              <div className="text-center">
                <h2 className="text-lg font-semibold text-on-surface">
                  {t("session.mic_access_denied")}
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  {t("session.mic_enable_steps")}
                </p>
              </div>

              <ol className="w-full space-y-2 rounded-xl border border-outline-variant/10 bg-surface-container-low p-4 text-sm text-on-surface-variant">
                <li className="flex gap-2">
                  <span className="shrink-0 font-semibold text-on-surface">1.</span>
                  {t("session.mic_step_1")}
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-semibold text-on-surface">2.</span>
                  {t("session.mic_step_2")}
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-semibold text-on-surface">3.</span>
                  {t("session.mic_step_3")}
                </li>
              </ol>

              <div className="flex w-full gap-3">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="flex-1 gap-2 border-outline-variant/30 bg-transparent text-on-surface-variant"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("session.go_back")}
                </Button>
                <Button
                  onClick={handleTryAgain}
                  className="flex-1 gap-2 bg-primary text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t("audioCheck.tryAgain")}
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
              className="mx-auto flex max-w-md flex-col items-center gap-5 rounded-3xl border border-outline-variant/50 bg-surface-container-lowest p-8 text-center shadow-token-card"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
                <MicOff className="h-10 w-10 text-red-400" />
              </div>

              <div className="text-center">
                <h2 className="text-lg font-semibold text-on-surface">
                  {t("session.no_microphone_detected")}
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  {t("session.connect_microphone")}
                </p>
              </div>

              <div className="flex w-full gap-3">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="flex-1 gap-2 border-outline-variant/30 bg-transparent text-on-surface-variant"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("session.go_back")}
                </Button>
                <Button
                  onClick={handleTryAgain}
                  className="flex-1 gap-2 bg-primary text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t("audioCheck.tryAgain")}
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
              className="mx-auto flex max-w-md flex-col items-center gap-5 rounded-3xl border border-outline-variant/50 bg-surface-container-lowest p-8 text-center shadow-token-card"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
                <MicOff className="h-10 w-10 text-red-400" />
              </div>

              <div className="text-center">
                <h2 className="text-lg font-semibold text-on-surface">
                  {t("session.microphone_error")}
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
                  {t("session.go_back")}
                </Button>
                <Button
                  onClick={handleTryAgain}
                  className="flex-1 gap-2 bg-primary text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t("audioCheck.tryAgain")}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
