"use client";

import { useTranslations } from "next-intl";
import { MessageSquareQuote } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { Phase } from "@/store/session-store";
import type { PracticeLanguage, PracticeTrack } from "@/types";

interface SessionTopBarProps {
  topicTitle: string;
  side: "proposition" | "opposition";
  practiceTrack: PracticeTrack;
  practiceLanguage: PracticeLanguage;
  mode: string;
  phase: Phase;
}

export function SessionTopBar({
  topicTitle,
  side,
  practiceTrack,
  practiceLanguage,
  mode,
  phase,
}: SessionTopBarProps) {
  const t = useTranslations("dashboard.practice");

  return (
    <header className="border-b border-outline-variant/70 bg-surface-container-lowest/95 backdrop-blur-xl">
      <div className="grid min-h-14 w-full grid-cols-1 gap-2 px-4 py-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center lg:px-6">
        <div className="flex items-center gap-2 justify-self-start">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-on-primary shadow-[0_12px_22px_-18px_rgba(77,134,247,0.9)]">
            <MessageSquareQuote className="h-4 w-4" />
          </div>
          <span className="text-lg font-bold tracking-normal text-on-surface">
            Debate<span className="text-primary">Lab</span>
          </span>
        </div>

        <h1 className="min-w-0 truncate text-left text-sm font-semibold tracking-normal text-on-surface sm:text-center">
          {topicTitle}
        </h1>

        <div className="flex shrink-0 items-center gap-2 justify-self-end">
          <span
            className={cn(
              "inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold",
              side === "proposition"
                ? "bg-secondary-container text-secondary-dim"
                : "bg-error-container text-error"
            )}
          >
            {side === "proposition" ? t("for") : t("against")}
          </span>
          <span className="inline-flex h-8 items-center rounded-md bg-surface-container px-2.5 text-xs font-semibold text-on-surface">
            {practiceTrack === "speaking"
              ? t("single_speech")
              : mode === "full"
                ? t("full_round")
                : t("quick_practice")}
          </span>
          <span className="hidden h-8 items-center rounded-md bg-surface-container px-2.5 text-xs font-semibold text-on-surface md:inline-flex">
            {practiceTrack === "speaking"
              ? t("speaking_practice")
              : t("debate_practice")}
          </span>
          <span className="hidden h-8 items-center rounded-md bg-surface-container px-2.5 text-xs font-semibold text-on-surface lg:inline-flex">
            {t(`practice_language_options.${practiceLanguage}`)}
          </span>
          {(phase === "speaking" || phase === "ai-rebuttal") && (
            <span
              className={cn(
                "inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold",
                phase === "speaking"
                  ? "bg-error-container text-error"
                  : "bg-primary-container text-primary"
              )}
            >
              {phase === "speaking" ? t("session.speaking") : t("session.ai_turn")}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
