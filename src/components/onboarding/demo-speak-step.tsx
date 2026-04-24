"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Mic, MicOff, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnboardingPreviewCard } from "./onboarding-primitives";
import { useDeepgramTranscription } from "@/hooks/use-deepgram-transcription";

interface DemoSpeakStepProps {
  topic: string;
  position: "FOR" | "AGAINST";
  onComplete: (transcript: string) => void;
  onSkip: () => void;
}

const DEMO_DURATION_SECONDS = 45;

export function DemoSpeakStep({
  topic,
  position,
  onComplete,
  onSkip,
}: DemoSpeakStepProps) {
  const [timeLeft, setTimeLeft] = useState(DEMO_DURATION_SECONDS);
  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const t = useTranslations("onboarding");
  const speech = useDeepgramTranscription();

  const stopRecording = useCallback(() => {
    speech.stopListening();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  }, [speech]);

  const handleDone = useCallback(() => {
    stopRecording();
    const finalTranscript = speech.transcript || "";
    onComplete(finalTranscript);
  }, [stopRecording, speech.transcript, onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startRecording = async () => {
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
      setHasStarted(true);
      setIsRecording(true);

      speech.startListening(stream);

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            requestAnimationFrame(() => handleDone());
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setMicError(true);
    }
  };

  // Progress ring calculation
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = timeLeft / DEMO_DURATION_SECONDS;
  const strokeDashoffset = circumference * (1 - progress);

  if (micError) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-error-container">
          <MicOff className="h-8 w-8 text-on-error-container" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-on-surface md:text-3xl">
          {t("demo_speak.mic_error")}
        </h2>
        <p className="mb-6 text-base text-on-surface-variant">
          {t("demo_speak.mic_error")}
        </p>
        <button
          onClick={onSkip}
          className="text-base font-medium text-primary transition-colors hover:text-primary-dim hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
        >
          {t("demo_speak.skip")}
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <OnboardingPreviewCard className="text-left">
          <p className="text-lg font-semibold leading-7 text-on-surface md:text-xl">
            {topic}
          </p>
          <span
            className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${
              position === "FOR"
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-error-container text-on-error-container"
            }`}
          >
            {position === "FOR" ? t("demo_intro.for") : t("demo_intro.against")}
          </span>
        </OnboardingPreviewCard>
      </motion.div>

      <OnboardingPreviewCard className="mb-6">
        <div className="relative mx-auto h-36 w-36">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="var(--color-outline-variant)"
              strokeWidth="6"
            />
            <motion.circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={timeLeft <= 5 ? "var(--color-error)" : "var(--color-primary)"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.5, ease: "linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`text-4xl font-bold ${
                timeLeft <= 5 ? "text-error" : "text-on-surface"
              }`}
            >
              {timeLeft}
            </span>
            <span className="text-xs text-on-surface-variant">
              {t("demo_speak.time_remaining", { seconds: timeLeft })}
            </span>
          </div>
        </div>
      </OnboardingPreviewCard>

      {isRecording && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 flex items-center justify-center gap-2"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-error" />
          <span className="text-sm font-medium text-on-surface-variant">
            {t("demo_speak.recording")}
          </span>
        </motion.div>
      )}

      {hasStarted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 min-h-[92px] rounded-[1.35rem] border border-outline-variant/60 bg-surface p-4 text-left shadow-[0_18px_44px_-38px_rgba(11,20,36,0.42)]"
        >
          {speech.transcript || speech.interimTranscript ? (
            <p className="text-base text-on-surface">
              {speech.transcript}
              {speech.interimTranscript && (
                <span className="text-on-surface-variant">
                  {" "}
                  {speech.interimTranscript}
                </span>
              )}
            </p>
          ) : (
            <p className="text-base italic text-on-surface-variant">
              {t("demo_speak.speak_placeholder")}
            </p>
          )}
        </motion.div>
      )}

      {/* Controls */}
      {!hasStarted ? (
        <Button
          onClick={startRecording}
          className="h-12 gap-2 rounded-2xl bg-primary px-8 text-lg font-semibold text-on-primary hover:bg-primary-dim"
          size="lg"
        >
          <Mic className="h-5 w-5" />
          {t("demo_speak.headline")}
        </Button>
      ) : (
        <Button
          onClick={handleDone}
          className="h-12 gap-2 rounded-2xl bg-error px-8 text-lg font-semibold text-on-error hover:bg-error-dim"
          size="lg"
        >
          <Square className="h-4 w-4" />
          {t("demo_speak.done")}
        </Button>
      )}

      <div className="mt-4">
        <button
          onClick={onSkip}
          className="text-base font-medium text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
        >
          {t("demo_speak.skip")}
        </button>
      </div>
    </div>
  );
}
