"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Loader2,
  MessageSquareText,
  Pause,
  RotateCcw,
  Volume2,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { useTTS } from "@/hooks/use-tts";
import { useTranslations } from "next-intl";
import {
  ActionRail,
  PhasePill,
  PracticePanel,
  PrimaryActionButton,
  QuickNotesEditor,
} from "./practice-session-ui";
import { cn } from "@/lib/utils";
import { normalizeStructuredRebuttalResponse } from "@/lib/rebuttal/structured-response";
import type {
  AiDifficulty,
  AiHighlight,
  PracticeLanguage,
  PracticeTrack,
} from "@/types";

interface AiRebuttalPhaseProps {
  topic: string;
  side: "proposition" | "opposition";
  userTranscript: string;
  roundLabel: string;
  difficulty: AiDifficulty;
  practiceTrack?: PracticeTrack;
  practiceLanguage: PracticeLanguage;
  previousRounds?: { label: string; speaker: string; text: string }[];
  prepNotes: string;
  onNotesChange: (notes: string) => void;
  onComplete: (rebuttal: string, highlights: AiHighlight[]) => void;
  onGenerated?: (rebuttal: string, highlights: AiHighlight[]) => void;
  initialResponse?: string;
  initialHighlights?: AiHighlight[];
  ttsVoice?: string;
}

function getHighlightClass(type: AiHighlight["type"]) {
  switch (type) {
    case "claim":
      return "bg-primary-container text-on-surface ring-primary/20";
    case "evidence":
      return "bg-secondary-container text-on-surface ring-secondary/20";
    case "impact":
      return "bg-warning/20 text-on-surface ring-warning/25";
    case "assumption":
      return "bg-error-container text-on-surface ring-error/20";
  }
}

function HighlightedResponse({
  text,
  highlights,
  isTyping,
}: {
  text: string;
  highlights: AiHighlight[];
  isTyping: boolean;
}) {
  if (!text) return null;

  const segments: Array<{
    text: string;
    highlight?: AiHighlight;
  }> = [];
  const lowerText = text.toLowerCase();
  let cursor = 0;
  const orderedHighlights = highlights
    .map((highlight) => ({
      highlight,
      index: lowerText.indexOf(highlight.quote.trim().toLowerCase()),
    }))
    .filter((item) => item.index >= 0)
    .sort((left, right) => left.index - right.index);

  orderedHighlights.forEach(({ highlight }) => {
    const quote = highlight.quote.trim();
    if (!quote) return;

    const start = lowerText.indexOf(quote.toLowerCase(), cursor);
    if (start === -1) return;

    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start) });
    }

    const end = start + quote.length;
    segments.push({ text: text.slice(start, end), highlight });
    cursor = end;
  });

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }

  return (
    <p className="font-sans text-base leading-8 text-on-surface">
      {segments.map((segment, index) =>
        segment.highlight ? (
          <mark
            key={`${segment.text}-${index}`}
            title={segment.highlight.note}
            className={cn(
              "rounded-md px-1 py-0.5 ring-1",
              getHighlightClass(segment.highlight.type)
            )}
          >
            {segment.text}
          </mark>
        ) : (
          <span key={`${segment.text}-${index}`}>{segment.text}</span>
        )
      )}
      {isTyping && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="inline-block h-5 w-0.5 translate-y-0.5 bg-primary"
        />
      )}
    </p>
  );
}

export function AiRebuttalPhase({
  topic,
  side,
  userTranscript,
  roundLabel,
  difficulty,
  practiceTrack = "debate",
  practiceLanguage,
  previousRounds,
  prepNotes,
  onNotesChange,
  onComplete,
  onGenerated,
  initialResponse = "",
  initialHighlights = [],
  ttsVoice = 'aura-asteria-en',
}: AiRebuttalPhaseProps) {
  const t = useTranslations('dashboard.practice');
  const normalizedInitialResponse = normalizeStructuredRebuttalResponse(
    initialResponse,
    initialHighlights
  );
  const [status, setStatus] = useState<"loading" | "typing" | "done" | "error">(
    normalizedInitialResponse.rebuttal ? "done" : "loading"
  );
  const [fullText, setFullText] = useState(normalizedInitialResponse.rebuttal);
  const [displayedText, setDisplayedText] = useState(
    normalizedInitialResponse.rebuttal
  );
  const [highlights, setHighlights] = useState<AiHighlight[]>(
    normalizedInitialResponse.highlights
  );
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(Boolean(normalizedInitialResponse.rebuttal));
  const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsTriggeredRef = useRef(false);
  const ttsWasLoadingRef = useRef(false);

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
    practiceLanguage,
    autoPlay: true,
  });

  const fetchRebuttal = useCallback(async () => {
    setStatus("loading");
    setError(null);
    setFullText("");
    setDisplayedText("");
    setHighlights([]);

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
          practiceTrack,
          practiceLanguage,
          previousRounds,
        }),
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Server error (${res.status})`);
      }

      const data = (await res.json()) as {
        rebuttal: string;
        highlights?: AiHighlight[];
      };
      const normalizedResponse = normalizeStructuredRebuttalResponse(
        data.rebuttal,
        data.highlights
      );
      setFullText(normalizedResponse.rebuttal);
      setHighlights(normalizedResponse.highlights);
      onGenerated?.(
        normalizedResponse.rebuttal,
        normalizedResponse.highlights
      );
      // Don't set status="typing" yet — wait for TTS audio to load first
      // so typewriter and audio start simultaneously
      ttsTriggeredRef.current = true;
      ttsSpeak(normalizedResponse.rebuttal);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("AI response timed out. Please try again.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to get AI response.");
      }
      setStatus("error");
    }
  }, [
    topic,
    side,
    userTranscript,
    roundLabel,
    difficulty,
    practiceTrack,
    practiceLanguage,
    previousRounds,
    onGenerated,
    ttsSpeak,
  ]);

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

  // Wait for TTS audio to load, then start typewriter so both run simultaneously
  useEffect(() => {
    if (ttsLoading) {
      ttsWasLoadingRef.current = true;
    }
    // Once TTS finishes loading (success, autoplay-blocked, or error) AND we have
    // text AND we haven't started typing yet → start the typewriter
    if (ttsWasLoadingRef.current && !ttsLoading && fullText && status === "loading") {
      setStatus("typing");
    }
  }, [ttsLoading, fullText, status]);

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
    onComplete(fullText, highlights);
  };

  const difficultyLabel =
    difficulty === "easy"
      ? t("easy")
      : difficulty === "hard"
        ? t("hard")
        : t("medium");
  const displayRoundLabel =
    roundLabel === "Opening Statement"
      ? t("session.round_opening")
      : roundLabel === "AI Rebuttal"
        ? t("session.round_ai_rebuttal")
        : roundLabel === "Counter-Rebuttal"
          ? t("session.round_counter_rebuttal")
          : roundLabel === "AI Closing"
            ? t("session.round_ai_closing")
            : roundLabel === "Closing Statement"
              ? t("session.round_closing")
              : roundLabel;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 px-4 py-3 sm:px-5 lg:px-6">
      <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.55fr)]">
        <PracticePanel className="p-4">
          <div className="flex items-start justify-between gap-4 border-b border-outline-variant/70 pb-4">
            <div className="flex items-center gap-3">
              <motion.div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-container"
                animate={
                  status === "loading"
                    ? { scale: [1, 1.04, 1] }
                    : status === "typing"
                      ? {
                          boxShadow: [
                            "0 0 0 0px rgba(77,134,247,0.22)",
                            "0 0 0 14px rgba(77,134,247,0)",
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
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : (
                  <Bot className="h-7 w-7 text-primary" />
                )}
              </motion.div>

              <div>
                <PhasePill tone="ai">{displayRoundLabel}</PhasePill>
                <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-on-surface">
                  {status === "done" ? (
                    <CheckCircle2 className="h-5 w-5 text-secondary" />
                  ) : status === "error" ? (
                    <AlertTriangle className="h-5 w-5 text-error" />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  )}
                  {status === "loading"
                    ? t("session.ai_preparing")
                    : status === "typing"
                      ? t("session.ai_speaking")
                      : status === "done"
                        ? t("session.ai_finished")
                        : t("session.error")}
                </div>
                <span className="mt-2 inline-flex rounded-md bg-surface-container px-2.5 py-1.5 text-xs font-semibold capitalize text-on-surface-variant">
                  {t("session.difficulty_label", { difficulty: difficultyLabel })}
                </span>
              </div>
            </div>

            {(status === "typing" || status === "done") && (
              <div className="flex flex-wrap justify-end gap-2">
                {status === "typing" && (
                  <Button
                    variant="outline"
                    onClick={handleSkipAnimation}
                    className="h-9 rounded-md border-outline-variant/70 bg-surface text-sm text-primary"
                  >
                    {t("session.skip_animation")}
                  </Button>
                )}
                {ttsLoading && (
                  <span className="inline-flex h-9 items-center gap-2 rounded-md bg-surface-container px-3 text-sm font-medium text-on-surface-variant">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('tts.generating')}
                  </span>
                )}
                {ttsPlaying && (
                  <Button variant="outline" onClick={ttsStop} className="h-9 gap-2 rounded-md border-outline-variant/70 bg-surface text-sm">
                    <Pause className="h-4 w-4" />
                    {t('tts.pause')}
                  </Button>
                )}
                {ttsHasPlayed && !ttsPlaying && !ttsLoading && (
                  <Button variant="outline" onClick={ttsReplay} className="h-9 gap-2 rounded-md border-outline-variant/70 bg-surface text-sm">
                    <RotateCcw className="h-4 w-4" />
                    {t('tts.replay')}
                  </Button>
                )}
                {ttsError && !ttsLoading && (
                  <Button
                    variant="outline"
                    onClick={() => { ttsTriggeredRef.current = false; ttsSpeak(fullText); }}
                    className="h-9 gap-2 rounded-md border-error/40 bg-error-container text-sm text-error"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t("session.try_audio_again")}
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="mt-4">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold tracking-normal text-on-surface">
                {t("session.ai_response")}
              </h2>
            </div>
            <div className="min-h-[300px] overflow-y-auto rounded-lg border border-outline-variant/80 bg-surface p-4">
              {status === "loading" ? (
                <div className="flex h-[260px] items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-7 w-7 animate-spin text-primary/70" />
                    <p className="text-sm font-medium text-on-surface-variant">
                      {t("session.generating_round", { round: displayRoundLabel })}
                    </p>
                  </div>
                </div>
              ) : status === "error" ? (
                <div className="flex h-[260px] flex-col items-center justify-center gap-3 text-center">
                  <AlertTriangle className="h-8 w-8 text-error" />
                  <p className="text-sm font-medium text-error">{error}</p>
                </div>
              ) : (
                <HighlightedResponse
                  text={displayedText}
                  highlights={highlights}
                  isTyping={status === "typing"}
                />
              )}
            </div>

            {highlights.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {highlights.map((highlight, index) => (
                  <span
                    key={`${highlight.type}-${index}`}
                    className={cn(
                      "inline-flex rounded-xl px-3 py-1.5 text-xs font-semibold capitalize ring-1",
                      getHighlightClass(highlight.type)
                    )}
                  >
                    {highlight.type}
                  </span>
                ))}
              </div>
            )}
          </div>
        </PracticePanel>

        <div className="flex min-w-0 flex-col gap-3">
          <QuickNotesEditor
            value={prepNotes}
            onChange={onNotesChange}
            helper={t("session.same_notes_helper")}
            minHeightClassName="min-h-[246px]"
          />

          <PracticePanel className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/15">
                <Volume2 className="h-5 w-5 text-warning" />
              </div>
              <div>
                <h3 className="text-base font-semibold tracking-normal text-on-surface">
                  {t("session.tip")}
                </h3>
                <p className="mt-1 text-sm font-medium leading-6 text-on-surface-variant">
                  {t("session.ai_highlight_tip")}
                </p>
              </div>
            </div>
          </PracticePanel>
        </div>
      </div>

      <ActionRail className="sticky bottom-4">
        <Button
          type="button"
          onClick={ttsStop}
          disabled={!ttsPlaying}
          variant="outline"
          className="h-11 min-w-[132px] gap-2 rounded-lg border-outline-variant/80 bg-surface text-sm font-semibold text-on-surface hover:bg-surface-container disabled:opacity-50"
        >
          <Pause className="h-4 w-4" />
          {t("session.pause")}
        </Button>
        {status === "error" ? (
          <PrimaryActionButton onClick={handleRetry}>
            {t("audioCheck.tryAgain")}
          </PrimaryActionButton>
        ) : (
          <PrimaryActionButton
            onClick={handleContinue}
            disabled={status !== "done"}
          >
            {status === "done" ? t("session.continue_next_round") : t("session.waiting")}
          </PrimaryActionButton>
        )}
      </ActionRail>
    </div>
  );
}
