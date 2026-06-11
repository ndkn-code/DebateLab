"use client";

import { useEffect, useRef, useState } from "react";
import { Bot } from "@/components/ui/icons";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { DebateRound } from "@/types";
import { PracticePanel } from "./practice-session-ui";
import { localizeRoundLabel } from "./round-labels";

interface RoundTranscriptTabsProps {
  /** Full-round mode rounds. Omit (or empty) for quick mode: single live pane. */
  rounds?: DebateRound[];
  currentRound?: number;
  liveTranscript: string;
  interimTranscript: string;
  className?: string;
}

function LivePane({
  transcript,
  interimTranscript,
  placeholder,
}: {
  transcript: string;
  interimTranscript: string;
  placeholder: string;
}) {
  const paneRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const handleScroll = () => {
    const pane = paneRef.current;
    if (!pane) return;
    const distanceFromBottom =
      pane.scrollHeight - pane.scrollTop - pane.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 56;
  };

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane || !shouldAutoScrollRef.current) return;
    pane.scrollTo({ top: pane.scrollHeight, behavior: "smooth" });
  }, [transcript, interimTranscript]);

  return (
    <div
      ref={paneRef}
      role="log"
      aria-label="Live speech transcript"
      aria-live="polite"
      onScroll={handleScroll}
      className="min-h-[162px] flex-1 overflow-y-auto rounded-xl bg-surface-container/60 p-4"
    >
      {!transcript && !interimTranscript ? (
        <p className="text-sm italic text-outline">{placeholder}</p>
      ) : (
        <p className="font-sans text-base leading-7 text-on-surface">
          <span>{transcript}</span>
          {interimTranscript && (
            <span className="italic text-on-surface-variant">
              {" "}
              {interimTranscript}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * Transcript panel. In full-round mode each speech gets its own tab, so the
 * opening, rebuttals and closing never run together; the active round keeps
 * transcribing live in its tab while past rounds stay readable.
 */
export function RoundTranscriptTabs({
  rounds,
  currentRound,
  liveTranscript,
  interimTranscript,
  className,
}: RoundTranscriptTabsProps) {
  const t = useTranslations("dashboard.practice");
  const visibleRounds =
    rounds?.filter(
      (round) =>
        currentRound == null ||
        round.roundNumber <= currentRound ||
        Boolean(round.transcript || round.aiResponse)
    ) ?? [];
  const isTabbed = visibleRounds.length > 0 && currentRound != null;
  // Manual tab picks are scoped to the round they were made in, so the panel
  // snaps back to the live tab whenever the session advances — no effect needed.
  const [manualPick, setManualPick] = useState<{
    round: number;
    atCurrentRound: number | undefined;
  } | null>(null);
  const selectedRound =
    manualPick && manualPick.atCurrentRound === currentRound
      ? manualPick.round
      : (currentRound ?? 1);

  const selected =
    visibleRounds.find((round) => round.roundNumber === selectedRound) ?? null;
  const isLiveTab = isTabbed && selectedRound === currentRound;
  const liveWordCount = liveTranscript
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

  return (
    <PracticePanel className={cn("flex min-h-[220px] flex-1 flex-col p-4 sm:p-5", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold tracking-normal text-on-surface">
          {isTabbed ? t("session.transcript_rounds") : t("session.live_transcript")}
        </h2>
        {isLiveTab || !isTabbed ? (
          <span className="shrink-0 text-sm font-medium text-on-surface-variant">
            {t("session.word_count", { count: liveWordCount })}
          </span>
        ) : null}
      </div>

      {isTabbed ? (
        <div
          role="tablist"
          aria-label={t("session.transcript_rounds")}
          className="mb-3 flex gap-1 overflow-x-auto rounded-full bg-surface-container p-1 scrollbar-hide"
        >
          {visibleRounds.map((round) => {
            const isActive = round.roundNumber === selectedRound;
            const isLive = round.roundNumber === currentRound;
            const isAiRound = round.type === "ai-rebuttal";

            return (
              <button
                key={round.roundNumber}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() =>
                  setManualPick({
                    round: round.roundNumber,
                    atCurrentRound: currentRound,
                  })
                }
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold transition-all",
                  isActive
                    ? "bg-surface text-on-surface shadow-token-card"
                    : "text-on-surface-variant hover:text-on-surface"
                )}
              >
                {isAiRound ? <Bot className="h-3.5 w-3.5" /> : null}
                {localizeRoundLabel(round.label, t)}
                {isLive ? (
                  <span className="relative flex h-2 w-2" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error/60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-error" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {!isTabbed || isLiveTab ? (
        <LivePane
          transcript={liveTranscript}
          interimTranscript={interimTranscript}
          placeholder={t("session.transcript_placeholder")}
        />
      ) : (
        <div className="min-h-[162px] flex-1 overflow-y-auto rounded-xl bg-surface-container/60 p-4">
          {selected?.transcript || selected?.aiResponse ? (
            <p className="font-sans text-base leading-7 text-on-surface">
              {selected.type === "ai-rebuttal"
                ? selected.aiResponse
                : selected.transcript}
            </p>
          ) : (
            <p className="text-sm italic text-outline">
              {t("session.transcript_empty_round")}
            </p>
          )}
        </div>
      )}
    </PracticePanel>
  );
}
