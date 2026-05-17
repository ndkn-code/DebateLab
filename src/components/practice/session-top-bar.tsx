"use client";

import { useTranslations } from "next-intl";
import { MessageSquareQuote } from "lucide-react";
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
      <div className="grid min-h-[92px] w-full grid-cols-1 gap-3 px-8 py-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="flex items-center gap-4 justify-self-start">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-on-primary shadow-[0_16px_26px_-18px_rgba(77,134,247,0.9)]">
            <MessageSquareQuote className="h-6 w-6" />
          </div>
          <span className="text-[1.55rem] font-bold tracking-normal text-on-surface">
            Debate<span className="text-primary">Lab</span>
          </span>
        </div>

        <h1 className="min-w-0 truncate text-center text-base font-semibold tracking-normal text-on-surface sm:max-w-[620px] sm:text-lg">
          {topicTitle}
        </h1>

        <div className="flex shrink-0 items-center gap-2 justify-self-end">
          <span
            className={cn(
              "inline-flex h-11 items-center rounded-xl px-4 text-sm font-semibold",
              side === "proposition"
                ? "bg-secondary-container text-secondary-dim"
                : "bg-error-container text-error"
            )}
          >
            {side === "proposition" ? "FOR" : "AGAINST"}
          </span>
          <span className="inline-flex h-11 items-center rounded-xl bg-surface-container px-4 text-sm font-semibold text-on-surface">
            {practiceTrack === "speaking"
              ? t("single_speech")
              : mode === "full"
                ? t("full_round")
                : t("quick_practice")}
          </span>
          <span className="inline-flex h-11 items-center rounded-xl bg-surface-container px-4 text-sm font-semibold text-on-surface">
            {practiceTrack === "speaking"
              ? t("speaking_practice")
              : t("debate_practice")}
          </span>
          <span className="inline-flex h-11 items-center rounded-xl bg-surface-container px-4 text-sm font-semibold text-on-surface">
            {t(`practice_language_options.${practiceLanguage}`)}
          </span>
          {(phase === "speaking" || phase === "ai-rebuttal") && (
            <span
              className={cn(
                "inline-flex h-11 items-center rounded-xl px-4 text-sm font-semibold",
                phase === "speaking"
                  ? "bg-error-container text-error"
                  : "bg-primary-container text-primary"
              )}
            >
              {phase === "speaking" ? "Speaking" : "AI Turn"}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
