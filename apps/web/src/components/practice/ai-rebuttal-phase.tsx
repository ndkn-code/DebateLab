"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Pause, Play, RotateCcw } from "@/components/ui/icons";
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
import { getSpeechRevealText } from "@/lib/tts-playback";
import { localizeRoundLabel } from "./round-labels";
import { normalizeStructuredRebuttalResponse } from "@/lib/rebuttal/structured-response";
import { AiQualityRatingWidget } from "@/components/ai-quality/ai-quality-rating-widget";
import type {
  AiDifficulty,
  AiHighlight,
  DebateMemory,
  MotionBrief,
  PracticeLanguage,
  PracticeTrack,
} from "@/types";

type RebuttalApiResponse = {
  rebuttal: string;
  highlights?: AiHighlight[];
  _aiRunId?: string | null;
};

const EMPTY_HIGHLIGHTS: AiHighlight[] = [];

interface AiRebuttalPhaseProps {
  topic: string;
  side: "proposition" | "opposition";
  userTranscript: string;
  roundLabel: string;
  difficulty: AiDifficulty;
  practiceTrack?: PracticeTrack;
  practiceLanguage: PracticeLanguage;
  previousRounds?: { label: string; speaker: string; text: string }[];
  speechTimeSeconds?: number;
  currentRoundNumber?: number;
  motionBrief?: MotionBrief;
  debateMemory?: DebateMemory | null;
  prepNotes: string;
  onNotesChange: (notes: string) => void;
  onComplete: (rebuttal: string, highlights: AiHighlight[]) => void;
  onGenerated?: (rebuttal: string, highlights: AiHighlight[]) => void;
  initialResponse?: string;
  initialHighlights?: AiHighlight[];
  ttsVoice?: string;
  showcaseState?: "loading" | "streaming" | "done" | "error";
  showcaseStreamingText?: string;
  showcaseError?: string;
}

function getInitialShowcaseStatus(
  showcaseState: AiRebuttalPhaseProps["showcaseState"],
  hasInitialResponse: boolean
) {
  if (showcaseState === "error") return "error";
  if (showcaseState === "loading" || showcaseState === "streaming") {
    return "loading";
  }
  return hasInitialResponse ? "done" : "loading";
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

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 1,
            delay: index * 0.16,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="h-2 w-2 rounded-full bg-primary"
        />
      ))}
    </span>
  );
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
  speechTimeSeconds,
  currentRoundNumber,
  motionBrief,
  debateMemory,
  prepNotes,
  onNotesChange,
  onComplete,
  onGenerated,
  initialResponse = "",
  initialHighlights = EMPTY_HIGHLIGHTS,
  ttsVoice = 'aura-asteria-en',
  showcaseState,
  showcaseError = "AI response generation failed in this fixture state.",
}: AiRebuttalPhaseProps) {
  const t = useTranslations('dashboard.practice');
  const reduceMotion = useReducedMotion();
  const normalizedInitialResponse = useMemo(
    () => normalizeStructuredRebuttalResponse(initialResponse, initialHighlights),
    [initialHighlights, initialResponse]
  );
  const isShowcase = Boolean(showcaseState);
  const [status, setStatus] = useState<"loading" | "speaking" | "paused" | "done" | "error">(
    isShowcase
      ? getInitialShowcaseStatus(showcaseState, Boolean(normalizedInitialResponse.rebuttal))
      : "loading"
  );
  const [fullText, setFullText] = useState(normalizedInitialResponse.rebuttal);
  const [displayedText, setDisplayedText] = useState(
    isShowcase ? normalizedInitialResponse.rebuttal : ""
  );
  const [highlights, setHighlights] = useState<AiHighlight[]>(
    normalizedInitialResponse.highlights
  );
  const [aiRunId, setAiRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    showcaseState === "error" ? showcaseError : null
  );
  const hasFetched = useRef(
    Boolean(normalizedInitialResponse.rebuttal) || isShowcase
  );
  const ttsTriggeredRef = useRef(false);

  const {
    speak: ttsSpeak,
    play: ttsPlay,
    pause: ttsPause,
    resume: ttsResume,
    replay: ttsReplay,
    playbackState: ttsPlaybackState,
    isLoading: ttsLoading,
    isPlaying: ttsPlaying,
    isPaused: ttsPaused,
    hasPlayed: ttsHasPlayed,
    error: ttsError,
    currentTimeSeconds,
    durationSeconds,
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
    ttsTriggeredRef.current = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const requestBody = {
        topic,
        side,
        userTranscript,
        roundLabel,
        difficulty,
        practiceTrack,
        practiceLanguage,
        previousRounds,
        speechTimeSeconds,
        currentRoundNumber,
        motionBrief,
        debateMemory,
        stream: true,
      };

      const res = await fetch("/api/rebuttal/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        signal: controller.signal,
        body: JSON.stringify(requestBody),
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Server error (${res.status})`);
      }

      let data: RebuttalApiResponse | null = null;
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentEvent = "message";
        let done = false;
        while (!done) {
          const chunk = await reader.read();
          done = chunk.done;
          buffer += decoder.decode(chunk.value ?? new Uint8Array(), {
            stream: !done,
          });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const lines = frame.split(/\r?\n/).map((line) => line.trim());
            const eventLine = lines.find((line) => line.startsWith("event:"));
            const dataLine = lines.find((line) => line.startsWith("data:"));
            if (eventLine) {
              currentEvent = eventLine.slice(6).trim();
            }
            if (!dataLine) continue;
            const payload = JSON.parse(dataLine.slice(5).trim()) as Record<
              string,
              unknown
            >;
            if (currentEvent === "final") {
              data = payload as unknown as RebuttalApiResponse;
            } else if (currentEvent === "error") {
              throw new Error(
                typeof payload.error === "string"
                  ? payload.error
                  : "Failed to get AI response."
              );
            }
          }
        }
      } else {
        data = (await res.json()) as RebuttalApiResponse;
      }

      if (!data) {
        throw new Error("AI response ended without a final answer.");
      }
      const finalData = data;
      const normalizedResponse = normalizeStructuredRebuttalResponse(
        finalData.rebuttal,
        finalData.highlights
      );
      setFullText(normalizedResponse.rebuttal);
      setDisplayedText("");
      setHighlights(normalizedResponse.highlights);
      setAiRunId(finalData._aiRunId ?? null);
      onGenerated?.(
        normalizedResponse.rebuttal,
        normalizedResponse.highlights
      );
      ttsTriggeredRef.current = true;
      void ttsSpeak(normalizedResponse.rebuttal);
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
    speechTimeSeconds,
    currentRoundNumber,
    motionBrief,
    debateMemory,
    onGenerated,
    ttsSpeak,
  ]);

  // Fetch on mount
  useEffect(() => {
    if (!hasFetched.current && !isShowcase) {
      hasFetched.current = true;
      fetchRebuttal();
    }
  }, [fetchRebuttal, isShowcase]);

  useEffect(() => {
    if (!showcaseState) return;

    setStatus(getInitialShowcaseStatus(showcaseState, Boolean(normalizedInitialResponse.rebuttal)));
    setFullText(normalizedInitialResponse.rebuttal);
    setDisplayedText(normalizedInitialResponse.rebuttal);
    setHighlights(normalizedInitialResponse.highlights);
    setError(showcaseState === "error" ? showcaseError : null);
    hasFetched.current = true;
  }, [
    normalizedInitialResponse.highlights,
    normalizedInitialResponse.rebuttal,
    showcaseError,
    showcaseState,
  ]);

  useEffect(() => {
    if (isShowcase || !fullText || ttsTriggeredRef.current) return;
    ttsTriggeredRef.current = true;
    setDisplayedText("");
    setStatus("loading");
    void ttsSpeak(fullText);
  }, [fullText, isShowcase, ttsSpeak]);

  useEffect(() => {
    if (isShowcase || !fullText) return;

    if (ttsPlaybackState === "loading" || ttsPlaybackState === "ready") {
      setDisplayedText("");
      setStatus(ttsPlaybackState === "ready" ? "paused" : "loading");
      return;
    }

    if (ttsPlaybackState === "playing" || ttsPlaybackState === "paused") {
      setDisplayedText(
        getSpeechRevealText({
          text: fullText,
          currentTimeSeconds,
          durationSeconds,
          locale: practiceLanguage,
        })
      );
      setStatus(ttsPlaybackState === "paused" ? "paused" : "speaking");
      return;
    }

    if (ttsPlaybackState === "ended") {
      setDisplayedText(fullText);
      setStatus("done");
      return;
    }

    if (ttsPlaybackState === "error") {
      setDisplayedText("");
      setError(ttsError || t("tts.error"));
      setStatus("error");
    }
  }, [
    currentTimeSeconds,
    durationSeconds,
    fullText,
    isShowcase,
    practiceLanguage,
    t,
    ttsError,
    ttsPlaybackState,
  ]);

  const handleRetry = () => {
    if (isShowcase) return;
    if (fullText) {
      setError(null);
      setDisplayedText("");
      setStatus("loading");
      ttsTriggeredRef.current = true;
      void ttsSpeak(fullText);
      return;
    }
    hasFetched.current = false;
    fetchRebuttal();
  };

  const handleReplay = () => {
    setDisplayedText("");
    setStatus("loading");
    void ttsReplay();
  };

  const handleResume = () => {
    void (ttsPlaybackState === "ready" ? ttsPlay() : ttsResume());
  };

  const handleContinue = () => {
    onComplete(fullText, highlights);
  };

  const displayRoundLabel = localizeRoundLabel(roundLabel, t);
  const canResumeSpeech = ttsPaused || ttsPlaybackState === "ready";
  const canReplaySpeech =
    ttsHasPlayed && !ttsPlaying && !ttsLoading && ttsPlaybackState === "ended";
  const playbackActionDisabled = !ttsPlaying && !canResumeSpeech;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 px-4 py-3 sm:px-5 lg:px-6">
      <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.55fr)]">
        <PracticePanel className="p-4">
          <div className="flex items-center justify-between gap-4 border-b border-outline-variant/60 pb-4">
            <div className="flex items-center gap-3.5">
              <motion.span
                className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-container"
                animate={
                  !reduceMotion && (status === "loading" || status === "speaking")
                    ? { scale: [1, 1.05, 1] }
                    : undefined
                }
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <Image
                  src={
                    status === "loading"
                      ? "/images/mascot/mascot-thinking.webp"
                      : "/coach/coach-pet.png"
                  }
                  alt=""
                  aria-hidden="true"
                  width={400}
                  height={400}
                  className="h-10 w-10 object-contain"
                  sizes="48px"
                />
              </motion.span>

              <div>
                <PhasePill tone="ai">{displayRoundLabel}</PhasePill>
                <p
                  className={cn(
                    "mt-1.5 text-sm font-semibold",
                    status === "error" ? "text-error" : "text-on-surface-variant"
                  )}
                  aria-live="polite"
                >
                  {status === "loading"
                    ? t("session.ai_preparing")
                    : status === "speaking"
                      ? t("session.ai_speaking")
                      : status === "done"
                        ? t("session.ai_finished")
                        : status === "paused"
                          ? t("session.paused")
                          : t("session.error")}
                </p>
              </div>
            </div>

            {fullText && !isShowcase && (
              <div className="flex flex-wrap justify-end gap-2">
                {ttsPlaying && (
                  <Button variant="outline" onClick={ttsPause} className="h-9 gap-2 rounded-full border-outline-variant/70 bg-surface text-sm">
                    <Pause className="h-4 w-4" />
                    {t('tts.pause')}
                  </Button>
                )}
                {canResumeSpeech && !ttsError && (
                  <Button variant="outline" onClick={handleResume} className="h-9 gap-2 rounded-full border-outline-variant/70 bg-surface text-sm">
                    <Play className="h-4 w-4" />
                    {t(ttsPlaybackState === "ready" ? 'tts.play' : 'tts.resume')}
                  </Button>
                )}
                {canReplaySpeech && (
                  <Button variant="outline" onClick={handleReplay} className="h-9 gap-2 rounded-full border-outline-variant/70 bg-surface text-sm">
                    <RotateCcw className="h-4 w-4" />
                    {t('tts.replay')}
                  </Button>
                )}
                {ttsError && !ttsLoading && (
                  <Button
                    variant="outline"
                    onClick={handleRetry}
                    className="h-9 gap-2 rounded-full border-error/40 bg-error-container text-sm text-error"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t("session.try_audio_again")}
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 flex min-h-[300px] flex-col rounded-xl bg-surface-container/60 p-5">
            {status === "loading" ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <Image
                    src="/images/mascot/mascot-thinking.webp"
                    alt=""
                    aria-hidden="true"
                    width={1254}
                    height={1254}
                    className="h-auto w-24 object-contain"
                    sizes="96px"
                  />
                  <ThinkingDots />
                </div>
              </div>
            ) : status === "error" ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <Image
                  src="/images/mascot/mascot-oops.webp"
                  alt=""
                  aria-hidden="true"
                  width={1254}
                  height={1254}
                  className="h-auto w-24 object-contain"
                  sizes="96px"
                />
                <p className="max-w-[36ch] text-sm font-medium text-error">{error}</p>
              </div>
            ) : (
              <HighlightedResponse
                text={displayedText}
                highlights={highlights}
                isTyping={status === "speaking"}
              />
            )}
          </div>

          {highlights.length > 0 && status === "done" && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {highlights.map((highlight, index) => (
                <span
                  key={`${highlight.type}-${index}`}
                  title={highlight.note}
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-1 type-caption font-bold ring-1",
                    getHighlightClass(highlight.type)
                  )}
                >
                  {t(`session.highlight_${highlight.type}`)}
                </span>
              ))}
            </div>
          )}
        </PracticePanel>

        <div className="flex min-w-0 flex-col gap-3">
          <QuickNotesEditor
            value={prepNotes}
            onChange={onNotesChange}
            helper={t("session.same_notes_helper")}
            minHeightClassName="min-h-[340px]"
          />
        </div>
      </div>

      <ActionRail className="sticky bottom-4">
        <Button
          type="button"
          onClick={ttsPlaying ? ttsPause : handleResume}
          disabled={playbackActionDisabled}
          variant="outline"
          className="h-11 min-w-[132px] gap-2 rounded-lg border-outline-variant/80 bg-surface text-sm font-semibold text-on-surface hover:bg-surface-container disabled:opacity-50"
        >
          {ttsPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {ttsPlaying ? t("session.pause") : t("tts.resume")}
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
      {status === "done" && (
        <AiQualityRatingWidget
          runId={aiRunId}
          outputType="rebuttal"
          locale={practiceLanguage}
        />
      )}
    </div>
  );
}
