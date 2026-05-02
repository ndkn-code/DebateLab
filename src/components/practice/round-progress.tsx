"use client";

import { motion } from "framer-motion";
import { User, Bot, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DebateRound } from "@/types";

interface RoundProgressProps {
  rounds: DebateRound[];
  currentRound: number;
}

export function RoundProgress({ rounds, currentRound }: RoundProgressProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1050px] items-start justify-center px-4 py-4">
      {rounds.map((round, i) => {
        const isActive = round.roundNumber === currentRound;
        const isCompleted = round.roundNumber < currentRound;
        const isUserRound = round.type === "user-speech";

        return (
          <div key={round.roundNumber} className="flex flex-1 items-start last:flex-none">
            {/* Step circle */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex min-w-[112px] flex-col items-center"
            >
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all",
                  isCompleted
                    ? "border-secondary bg-secondary-container text-secondary-dim"
                    : isActive
                      ? "border-primary bg-primary-container text-primary shadow-[0_14px_32px_-24px_rgba(77,134,247,0.9)]"
                      : "border-outline-variant/70 bg-surface text-outline"
                )}
              >
                {isCompleted ? (
                  <Check className="h-6 w-6" />
                ) : isUserRound ? (
                  <User className="h-6 w-6" />
                ) : (
                  <Bot className="h-6 w-6" />
                )}
              </div>
              <span
                className={cn(
                  "mt-2 max-w-[92px] text-center text-sm leading-tight",
                  isActive
                    ? "font-medium text-primary"
                    : isCompleted
                      ? "text-on-surface-variant"
                      : "text-outline-variant"
                )}
              >
                {round.label}
              </span>
            </motion.div>

            {/* Connector line */}
            {i < rounds.length - 1 && (
              <div
                className={cn(
                  "mx-4 mt-7 h-0.5 flex-1 rounded-full border-t border-dashed",
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
