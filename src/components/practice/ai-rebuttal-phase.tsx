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
} from "lucide-react";
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
import type { AiDifficulty, AiHighlight, PracticeTrack } from "@/types";

interface AiRebuttalPhaseProps {
  topic: string;
  side: "proposition" | "opposition";
  userTranscript: string;
  roundLabel: string;
  difficulty: AiDifficulty;
  practiceTrack?: PracticeTrack;
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
    <p className="font-serif text-[1.2rem] leading-9 text-on-surface">
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
  const [status, setStatus] = useState<"loading" | "typing" | "done" | "error">(
    initialResponse ? "done" : "loading"
  );
  const [fullText, setFullText] = useState(initialResponse);
  const [displayedText, setDisplayedText] = useState(initialResponse);
  const [highlights, setHighlights] = useState<AiHighlight[]>(initialHighlights);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(Boolean(initialResponse));
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
      const responseHighlights = Array.isArray(data.highlights)
        ? data.highlights
        : [];
      setFullText(data.rebuttal);
      setHighlights(responseHighlights);
      onGenerated?.(data.rebuttal, responseHighlights);
      // Don't set status="typing" yet — wait for TTS audio to load first
      // so typewriter and audio start simultaneously
      ttsTriggeredRef.current = true;
      ttsSpeak(data.rebuttal);
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

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col gap-6 px-6 py-7 lg:px-8">
      <div className="grid flex-1 gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,0.85fr)]">
        <PracticePanel className="p-7">
          <div className="flex items-start justify-between gap-5 border-b border-outline-variant/70 pb-7">
            <div className="flex items-center gap-5">
              <motion.div
                className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-primary-container"
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
                  <Loader2 className="h-11 w-11 animate-spin text-primary" />
                ) : (
                  <Bot className="h-12 w-12 text-primary" />
                )}
              </motion.div>

              <div>
                <PhasePill tone="ai">{roundLabel}</PhasePill>
                <div className="mt-4 flex items-center gap-2 text-base font-semibold text-on-surface">
                  {status === "done" ? (
                    <CheckCircle2 className="h-5 w-5 text-secondary" />
                  ) : status === "error" ? (
                    <AlertTriangle className="h-5 w-5 text-error" />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  )}
                  {status === "loading"
                    ? "AI is preparing a response..."
                    : status === "typing"
                      ? "AI is speaking..."
                      : status === "done"
                        ? "AI has finished"
                        : "Error"}
                </div>
                <span className="mt-4 inline-flex rounded-xl bg-surface-container px-3 py-2 text-sm font-semibold capitalize text-on-surface-variant">
                  {difficulty} difficulty
                </span>
              </div>
            </div>

            {(status === "typing" || status === "done") && (
              <div className="flex flex-wrap justify-end gap-2">
                {status === "typing" && (
                  <Button
                    variant="outline"
                    onClick={handleSkipAnimation}
                    className="h-11 rounded-xl border-outline-variant/70 bg-surface text-primary"
                  >
                    Skip animation
                  </Button>
                )}
                {ttsLoading && (
                  <span className="inline-flex h-11 items-center gap-2 rounded-xl bg-surface-container px-3 text-sm font-medium text-on-surface-variant">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('tts.generating')}
                  </span>
                )}
                {ttsPlaying && (
                  <Button variant="outline" onClick={ttsStop} className="h-11 gap-2 rounded-xl border-outline-variant/70 bg-surface">
                    <Pause className="h-4 w-4" />
                    {t('tts.pause')}
                  </Button>
                )}
                {ttsHasPlayed && !ttsPlaying && !ttsLoading && (
                  <Button variant="outline" onClick={ttsReplay} className="h-11 gap-2 rounded-xl border-outline-variant/70 bg-surface">
                    <RotateCcw className="h-4 w-4" />
                    {t('tts.replay')}
                  </Button>
                )}
                {ttsError && !ttsLoading && (
                  <Button
                    variant="outline"
                    onClick={() => { ttsTriggeredRef.current = false; ttsSpeak(fullText); }}
                    className="h-11 gap-2 rounded-xl border-error/40 bg-error-container text-error"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Try audio again
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="mt-6">
            <div className="mb-4 flex items-center gap-3">
              <MessageSquareText className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-semibold tracking-normal text-on-surface">
                AI Response
              </h2>
            </div>
            <div className="min-h-[420px] overflow-y-auto rounded-2xl border border-outline-variant/80 bg-surface p-6">
              {status === "loading" ? (
                <div className="flex h-[360px] items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-7 w-7 animate-spin text-primary/70" />
                    <p className="text-sm font-medium text-on-surface-variant">
                      Generating {roundLabel.toLowerCase()}...
                    </p>
                  </div>
                </div>
              ) : status === "error" ? (
                <div className="flex h-[360px] flex-col items-center justify-center gap-3 text-center">
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

        <div className="flex min-w-0 flex-col gap-6">
          <QuickNotesEditor
            value={prepNotes}
            onChange={onNotesChange}
            helper="Same notes from prep. Keep adding counterpoints while the AI debates."
            minHeightClassName="min-h-[360px]"
          />

          <PracticePanel className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-warning/15">
                <Volume2 className="h-6 w-6 text-warning" />
              </div>
              <div>
                <h3 className="text-base font-semibold tracking-normal text-on-surface">
                  Tip
                </h3>
                <p className="mt-1 text-sm font-medium leading-6 text-on-surface-variant">
                  Highlighted phrases mark the AI&apos;s claim, evidence,
                  impact, or assumption. Add your counter-rebuttal ideas in
                  Quick Notes before continuing.
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
          className="h-14 min-w-[160px] gap-3 rounded-2xl border-outline-variant/80 bg-surface text-base font-semibold text-on-surface hover:bg-surface-container disabled:opacity-50"
        >
          <Pause className="h-5 w-5" />
          Pause
        </Button>
        {status === "error" ? (
          <PrimaryActionButton onClick={handleRetry}>
            Try Again
          </PrimaryActionButton>
        ) : (
          <PrimaryActionButton
            onClick={handleContinue}
            disabled={status !== "done"}
          >
            {status === "done" ? "Continue to Next Round" : "Waiting..."}
          </PrimaryActionButton>
        )}
      </ActionRail>
    </div>
  );
}
