"use client";

import { Bot, User } from "@/components/ui/icons";
import { SuccessCheck } from "@/components/motion";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { DebateRound } from "@/types";

interface RoundProgressProps {
  rounds: DebateRound[];
  currentRound: number;
}

export function RoundProgress({ rounds, currentRound }: RoundProgressProps) {
  const t = useTranslations("dashboard.practice");
  const getRoundLabel = (label: string) => {
    if (label === "Opening Statement") return t("session.round_opening");
    if (label === "AI Rebuttal") return t("session.round_ai_rebuttal");
    if (label === "Counter-Rebuttal")
      return t("session.round_counter_rebuttal");
    if (label === "AI Closing") return t("session.round_ai_closing");
    if (label === "Closing Statement") return t("session.round_closing");
    return label;
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-2.5">
      <div
        className="grid w-full items-start gap-3 overflow-x-auto pb-1"
        style={{
          gridTemplateColumns: `repeat(${rounds.length}, minmax(88px, 1fr))`,
        }}
      >
        {rounds.map((round) => {
          const isActive = round.roundNumber === currentRound;
          const isCompleted = round.roundNumber < currentRound;
          const isUserRound = round.type === "user-speech";

          return (
            <div
              key={round.roundNumber}
              className="flex min-w-0 flex-col items-center"
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border transition-all",
                  isCompleted
                    ? "border-secondary bg-secondary-container text-secondary-dim"
                    : isActive
                      ? "border-primary bg-primary-container text-primary shadow-token-primary"
                      : "border-outline-variant/70 bg-surface text-outline",
                )}
              >
                {isCompleted ? (
                  <SuccessCheck size={22} />
                ) : isUserRound ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <span
                className={cn(
                  "mt-1.5 max-w-[92px] text-center text-xs leading-tight",
                  isActive
                    ? "font-medium text-primary"
                    : isCompleted
                      ? "text-on-surface-variant"
                      : "text-outline-variant",
                )}
              >
                {getRoundLabel(round.label)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
