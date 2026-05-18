"use client";

import { motion } from "framer-motion";
import { User, Bot, Check } from "lucide-react";
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
    if (label === "Counter-Rebuttal") return t("session.round_counter_rebuttal");
    if (label === "AI Closing") return t("session.round_ai_closing");
    if (label === "Closing Statement") return t("session.round_closing");
    return label;
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl items-start justify-center px-4 py-2.5">
      {rounds.map((round, i) => {
        const isActive = round.roundNumber === currentRound;
        const isCompleted = round.roundNumber < currentRound;
        const isUserRound = round.type === "user-speech";

        return (
          <div key={round.roundNumber} className="flex flex-1 items-start last:flex-none">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex min-w-[86px] flex-col items-center"
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border transition-all",
                  isCompleted
                    ? "border-secondary bg-secondary-container text-secondary-dim"
                    : isActive
                      ? "border-primary bg-primary-container text-primary shadow-[0_14px_32px_-24px_rgba(77,134,247,0.9)]"
                      : "border-outline-variant/70 bg-surface text-outline"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : isUserRound ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <span
                className={cn(
                  "mt-1.5 max-w-[80px] text-center text-xs leading-tight",
                  isActive
                    ? "font-medium text-primary"
                    : isCompleted
                      ? "text-on-surface-variant"
                      : "text-outline-variant"
                )}
              >
                {getRoundLabel(round.label)}
              </span>
            </motion.div>

            {i < rounds.length - 1 && (
              <div
                className={cn(
                  "mx-2 mt-[18px] h-0.5 flex-1 rounded-full border-t border-dashed",
                  round.roundNumber < currentRound
                    ? "border-primary"
                    : "border-outline-variant"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
