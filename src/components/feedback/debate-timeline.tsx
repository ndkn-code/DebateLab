"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Bot, ChevronDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DebateRound } from "@/types";

interface DebateTimelineProps {
  rounds: DebateRound[];
}

export function DebateTimeline({ rounds }: DebateTimelineProps) {
  const [expandedRound, setExpandedRound] = useState<number | null>(null);

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-on-surface">
        Debate Timeline
      </h2>

      <div className="space-y-3">
        {rounds.map((round, i) => {
          const isUser = round.type === "user-speech";
          const text = isUser ? round.transcript : round.aiResponse;
          const isExpanded = expandedRound === round.roundNumber;
          const wordCount = text
            ? text.split(/\s+/).filter((w) => w.length > 0).length
            : 0;

          if (!text) return null;

          return (
            <motion.div
              key={round.roundNumber}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                "rounded-xl border bg-gradient-to-br p-4",
                isUser
                  ? "border-primary/10 from-primary-container/30 to-primary-container/10"
                  : "border-outline-variant/10 from-surface-container-low to-surface-container-lowest"
              )}
            >
              {/* Header */}
              <button
                onClick={() =>
                  setExpandedRound(isExpanded ? null : round.roundNumber)
                }
                className="flex w-full items-center gap-3"
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    isUser ? "bg-primary/10 text-primary" : "bg-outline-variant/10 text-on-surface-variant"
                  )}
                >
                  {isUser ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>

                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-on-surface">
                      Round {round.roundNumber}: {round.label}
                    </span>
                    <span className="text-[11px] text-outline-variant">
                      {isUser ? "You" : "AI"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-on-surface-variant">
                    <span>{wordCount} words</span>
                    {round.duration && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {Math.floor(round.duration / 60)}:{String(round.duration % 60).padStart(2, "0")}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-on-surface-variant transition-transform",
                    isExpanded && "rotate-180"
                  )}
                />
              </button>

              {/* Expanded content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="mt-3 whitespace-pre-wrap border-t border-outline-variant/10 pt-3 font-serif text-sm leading-relaxed text-on-surface-variant">
                      {text}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
