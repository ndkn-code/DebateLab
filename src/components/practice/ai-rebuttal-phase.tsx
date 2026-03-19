"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Bot, Loader2, AlertTriangle, RotateCcw, ArrowRight, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTTS } from "@/hooks/use-tts";
import { useTranslations } from "next-intl";
import type { AiDifficulty } from "@/types";

interface AiRebuttalPhaseProps {
  topic: string;
  side: "proposition" | "opposition";
  userTranscript: string;
  roundLabel: string;
  difficulty: AiDifficulty;
  previousRounds?: { label: string; speaker: string; text: string }[];
  onComplete: (rebuttal: string) => void;
  ttsVoice?: string;
}

export function AiRebuttalPhase({
  topic,
  side,
  userTranscript,
  roundLabel,
  difficulty,
  previousRounds,
  onComplete,
  ttsVoice = 'aura-asteria-en',
}: AiRebuttalPhaseProps) {
  const t = useTranslations('dashboard.practice');
  const [status, setStatus] = useState<"loading" | "typing" | "done" | "error">("loading");
  const [fullText, setFullText] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);
  const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsTriggeredRef = useRef(false);

  const {
    speak: ttsSpeak,
    stop: ttsStop,
    replay: ttsReplay,
    isLoading: ttsLoading,
    isPlaying: ttsPlaying,
    hasPlayed: ttsHasPlayed,
    error: ttsError,
  } = useTTS({
    voice: ttsVoice,
    autoPlay: true,
  });

  const fetchRebuttal = useCallback(async () => {
    setStatus("loading");
    setError(null);
    setFullText("");
    setDisplayedText("");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch("/api/rebuttal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          topic,
          side,
          userTranscript,
          roundLabel,
          difficulty,
          previousRounds,
        }),
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Server error (${res.status})`);
      }

      const data = (await res.json()) as { rebuttal: string };
      setFullText(data.rebuttal);
      setStatus("typing");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("AI response timed out. Please try again.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to get AI response.");
      }
      setStatus("error");
    }
  }, [topic, side, userTranscript, roundLabel, difficulty, previousRounds]);

  // Fetch on mount
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchRebuttal();
    }
  }, [fetchRebuttal]);

  // Typewriter effect
  useEffect(() => {
    if (status !== "typing" || !fullText) return;

    let charIndex = 0;
    const speed = 25; // ms per character

    const typeNext = () => {
      if (charIndex < fullText.length) {
        charIndex++;
        setDisplayedText(fullText.substring(0, charIndex));
        typewriterRef.current = setTimeout(typeNext, speed);
      } else {
        setStatus("done");
      }
    };

    typewriterRef.current = setTimeout(typeNext, speed);

    return () => {
      if (typewriterRef.current) {
        clearTimeout(typewriterRef.current);
      }
    };
  }, [status, fullText]);

  // Trigger TTS as soon as full text is available (parallel with typewriter)
  useEffect(() => {
    if (status === "typing" && fullText && !ttsTriggeredRef.current) {
      ttsTriggeredRef.current = true;
      ttsSpeak(fullText);
    }
  }, [status, fullText, ttsSpeak]);

  const handleSkipAnimation = () => {
    if (typewriterRef.current) {
      clearTimeout(typewriterRef.current);
    }
    setDisplayedText(fullText);
    setStatus("done");
  };

  const handleRetry = () => {
    hasFetched.current = false;
    fetchRebuttal();
  };

  const handleContinue = () => {
    onComplete(fullText);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      {/* Phase label */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <span className="rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          {roundLabel}
        </span>
      </motion.div>

      {/* AI avatar */}
      <div className="flex flex-col items-center gap-2">
        <motion.div
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
          animate={
            status === "loading"
              ? { scale: [1, 1.05, 1] }
              : status === "typing"
                ? {
                    boxShadow: [
                      "0 0 0 0px rgba(47,79,221,0.2)",
                      "0 0 0 8px rgba(47,79,221,0)",
                    ],
                  }
                : {}
          }
          transition={
            status === "loading"
              ? { duration: 1.5, repeat: Infinity }
              : status === "typing"
                ? { duration: 1.5, repeat: Infinity }
                : {}
          }
        >
          {status === "loading" ? (
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          ) : (
            <Bot className="h-7 w-7 text-primary" />
          )}
        </motion.div>
        <span className="text-xs font-medium text-on-surface-variant">
          {status === "loading"
            ? "AI is preparing a response..."
            : status === "typing"
              ? "AI is speaking..."
              : status === "done"
                ? "AI has finished"
                : "Error"}
        </span>
      </div>

      {/* Difficulty badge */}
      <div className="flex justify-center">
        <span className="rounded-full bg-surface-container-high px-3 py-1 text-[11px] font-medium capitalize text-on-surface-variant">
          {difficulty} difficulty
        </span>
      </div>

      {/* Rebuttal text area */}
      <div className="relative flex-1">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-on-surface-variant">
            AI Response
          </span>
          {status === "typing" && (
            <button
              onClick={handleSkipAnimation}
              className="text-xs text-primary hover:underline"
            >
              Skip animation
            </button>
          )}
        </div>
        <div className="h-56 overflow-y-auto rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 sm:h-64">
          {status === "loading" ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
                <p className="text-sm text-outline-variant">
                  Generating {roundLabel.toLowerCase()}...
                </p>
              </div>
            </div>
          ) : status === "error" ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          ) : (
            <p className="font-serif text-[15px] leading-relaxed text-on-surface">
              {displayedText}
              {status === "typing" && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="inline-block h-5 w-0.5 translate-y-0.5 bg-primary"
                />
              )}
            </p>
          )}
        </div>
      </div>

      {/* TTS controls */}
      {(status === "typing" || status === "done") && (
        <div className="flex items-center justify-center gap-2">
          {ttsLoading && (
            <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('tts.generating')}
            </span>
          )}

          {ttsPlaying && (
            <Button variant="ghost" size="sm" onClick={ttsStop} className="gap-1">
              <Pause className="h-3.5 w-3.5" />
              {t('tts.pause')}
            </Button>
          )}

          {ttsHasPlayed && !ttsPlaying && !ttsLoading && (
            <Button variant="ghost" size="sm" onClick={ttsReplay} className="gap-1">
              <RotateCcw className="h-3.5 w-3.5" />
              {t('tts.replay')}
            </Button>
          )}

          {ttsError && !ttsLoading && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-destructive">{t('tts.error')}</span>
              <Button variant="ghost" size="sm" onClick={() => { ttsTriggeredRef.current = false; ttsSpeak(fullText); }} className="gap-1 text-xs">
                <RotateCcw className="h-3 w-3" />
                Try again
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="sticky bottom-4 flex items-center justify-center gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-lowest/95 p-3 backdrop-blur-xl">
        {status === "error" ? (
          <Button
            onClick={handleRetry}
            className="gap-2 bg-primary text-white"
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </Button>
        ) : (
          <Button
            onClick={handleContinue}
            disabled={status !== "done"}
            className="gap-2 bg-primary text-white disabled:opacity-50"
          >
            <ArrowRight className="h-4 w-4" />
            {status === "done" ? "Continue to Next Round" : "Waiting..."}
          </Button>
        )}
      </div>
    </div>
  );
}
