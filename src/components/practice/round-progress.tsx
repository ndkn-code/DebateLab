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
    <div className="flex items-center justify-center gap-0 px-4 py-3">
      {rounds.map((round, i) => {
        const isActive = round.roundNumber === currentRound;
        const isCompleted = round.roundNumber < currentRound;
        const isUserRound = round.type === "user-speech";

        return (
          <div key={round.roundNumber} className="flex items-center">
            {/* Step circle */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex flex-col items-center"
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                  isCompleted
                    ? "border-primary bg-primary text-on-primary"
                    : isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline-variant/30 bg-surface-container-low text-outline-variant"
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
                  "mt-1 max-w-[72px] text-center text-[10px] leading-tight",
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
                  "mx-1 mt-[-16px] h-0.5 w-6 rounded-full sm:w-10",
                  round.roundNumber < currentRound
                    ? "bg-primary"
                    : "bg-outline-variant/20"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
