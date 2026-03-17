"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Mic, MicOff, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeepgramTranscription } from "@/hooks/use-deepgram-transcription";

interface DemoSpeakStepProps {
  topic: string;
  position: "FOR" | "AGAINST";
  onComplete: (transcript: string) => void;
  onSkip: () => void;
}

export function DemoSpeakStep({
  topic,
  position,
  onComplete,
  onSkip,
}: DemoSpeakStepProps) {
  const [timeLeft, setTimeLeft] = useState(30);
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

  // Auto-stop at 0
  useEffect(() => {
    if (timeLeft <= 0 && isRecording) {
      handleDone();
    }
  }, [timeLeft, isRecording, handleDone]);

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
  const progress = timeLeft / 30;
  const strokeDashoffset = circumference * (1 - progress);

  if (micError) {
    return (
      <div className="text-center">
        <div className="mb-6 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-red-100">
          <MicOff className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="mb-2 text-2xl md:text-3xl font-bold text-on-surface">
          {t("demo_speak.mic_error")}
        </h2>
        <p className="mb-6 text-base text-gray-500">
          {t("demo_speak.mic_error")}
        </p>
        <button
          onClick={onSkip}
          className="text-base font-medium text-primary hover:underline"
        >
          {t("demo_speak.skip")}
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      {/* Topic banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <p className="text-lg md:text-xl font-medium text-gray-600">{topic}</p>
        <span
          className={`mt-2 inline-block rounded-full px-4 py-1 text-sm font-bold ${
            position === "FOR"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-rose-100 text-rose-700"
          }`}
        >
          {position}
        </span>
      </motion.div>

      {/* Timer ring */}
      <div className="relative mx-auto mb-6 h-36 w-36">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="6"
          />
          <motion.circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={timeLeft <= 5 ? "#ef4444" : "#2f4fdd"}
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
              timeLeft <= 5 ? "text-red-500" : "text-on-surface"
            }`}
          >
            {timeLeft}
          </span>
          <span className="text-xs text-gray-400">{t("demo_speak.time_remaining", { seconds: timeLeft })}</span>
        </div>
      </div>

      {/* Mic indicator */}
      {isRecording && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 flex items-center justify-center gap-2"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <span className="text-sm text-gray-500">Recording...</span>
        </motion.div>
      )}

      {/* Transcript */}
      {hasStarted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 min-h-[80px] rounded-2xl border border-gray-200 bg-white p-4 text-left"
        >
          {speech.transcript || speech.interimTranscript ? (
            <p className="text-base text-on-surface">
              {speech.transcript}
              {speech.interimTranscript && (
                <span className="text-gray-400">
                  {" "}
                  {speech.interimTranscript}
                </span>
              )}
            </p>
          ) : (
            <p className="text-base text-gray-400 italic">
              Start speaking... your words will appear here
            </p>
          )}
        </motion.div>
      )}

      {/* Controls */}
      {!hasStarted ? (
        <Button
          onClick={startRecording}
          className="gap-2 rounded-xl bg-primary px-8 py-3 text-lg font-semibold text-white"
          size="lg"
        >
          <Mic className="h-5 w-5" />
          {t("demo_speak.headline")}
        </Button>
      ) : (
        <Button
          onClick={handleDone}
          className="gap-2 rounded-xl bg-red-500 px-8 py-3 text-lg font-semibold text-white hover:bg-red-600"
          size="lg"
        >
          <Square className="h-4 w-4" />
          {t("demo_speak.done")}
        </Button>
      )}

      <div className="mt-4">
        <button
          onClick={onSkip}
          className="text-base text-gray-400 hover:text-gray-600"
        >
          {t("demo_speak.skip")}
        </button>
      </div>
    </div>
  );
}
