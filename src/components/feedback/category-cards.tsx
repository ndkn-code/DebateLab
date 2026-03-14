"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquareText,
  LayoutList,
  Languages,
  Megaphone,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DebateScore } from "@/types/feedback";

interface CategoryConfig {
  key: keyof Pick<DebateScore, "content" | "structure" | "language" | "persuasion">;
  label: string;
  icon: React.ElementType;
  maxScore: number;
  gradient: string;
  barColor: string;
  feedbackKey: keyof DebateScore["detailedFeedback"];
  subScores: {
    key: string;
    label: string;
    max: number;
  }[];
}

const categories: CategoryConfig[] = [
  {
    key: "content",
    label: "Content & Argumentation",
    icon: MessageSquareText,
    maxScore: 40,
    gradient: "from-primary-container/50 to-primary-container/20",
    barColor: "bg-primary",
    feedbackKey: "contentFeedback",
    subScores: [
      { key: "claimClarity", label: "Claim Clarity", max: 10 },
      { key: "evidenceSupport", label: "Evidence & Reasoning", max: 10 },
      { key: "logicCoherence", label: "Logic & Coherence", max: 10 },
      { key: "counterArgument", label: "Counter-Arguments", max: 10 },
    ],
  },
  {
    key: "structure",
    label: "Structure & Organization",
    icon: LayoutList,
    maxScore: 25,
    gradient: "from-tertiary-container/50 to-tertiary-container/20",
    barColor: "bg-tertiary",
    feedbackKey: "structureFeedback",
    subScores: [
      { key: "introduction", label: "Introduction", max: 8 },
      { key: "bodyOrganization", label: "Body Organization", max: 9 },
      { key: "conclusion", label: "Conclusion", max: 8 },
    ],
  },
  {
    key: "language",
    label: "Language & Delivery",
    icon: Languages,
    maxScore: 25,
    gradient: "from-secondary-container/50 to-secondary-container/20",
    barColor: "bg-secondary",
    feedbackKey: "languageFeedback",
    subScores: [
      { key: "vocabulary", label: "Vocabulary", max: 8 },
      { key: "grammar", label: "Grammar", max: 9 },
      { key: "fluency", label: "Fluency", max: 8 },
    ],
  },
  {
    key: "persuasion",
    label: "Persuasiveness",
    icon: Megaphone,
    maxScore: 10,
    gradient: "from-[#fff9e5] to-[#fff9e5]/50",
    barColor: "bg-[#b28b00]",
    feedbackKey: "persuasionFeedback",
    subScores: [
      { key: "audienceAwareness", label: "Audience Awareness", max: 5 },
      { key: "impactfulness", label: "Impactfulness", max: 5 },
    ],
  },
];

interface CategoryCardsProps {
  feedback: DebateScore;
}

export function CategoryCards({ feedback }: CategoryCardsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {categories.map((cat, i) => {
        const categoryData = feedback[cat.key];
        const isExpanded = expandedIndex === i;
        const percentage = (categoryData.score / cat.maxScore) * 100;

        return (
          <motion.div
            key={cat.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "rounded-xl border border-outline-variant/10 bg-gradient-to-br p-5 transition-colors hover:border-outline-variant/30",
              cat.gradient
            )}
          >
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <cat.icon className="h-5 w-5 text-on-surface-variant" />
                <span className="text-sm font-medium text-on-surface">
                  {cat.label}
                </span>
              </div>
              <span className="text-lg font-bold text-on-surface">
                {categoryData.score}
                <span className="text-sm font-normal text-on-surface-variant">
                  /{cat.maxScore}
                </span>
              </span>
            </div>

            {/* Main progress bar */}
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-outline-variant/20">
              <motion.div
                className={cn("h-full rounded-full", cat.barColor)}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 1, delay: 0.3 + i * 0.1, ease: "easeOut" }}
              />
            </div>

            {/* Sub-scores */}
            <div className="space-y-2.5">
              {cat.subScores.map((sub) => {
                const value =
                  categoryData[sub.key as keyof typeof categoryData] as number;
                const subPct = (value / sub.max) * 100;

                return (
                  <div key={sub.key} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-xs text-on-surface-variant">
                      {sub.label}
                    </span>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-outline-variant/20">
                      <motion.div
                        className={cn("h-full rounded-full", cat.barColor)}
                        style={{ opacity: 0.7 }}
                        initial={{ width: 0 }}
                        animate={{ width: `${subPct}%` }}
                        transition={{
                          duration: 0.8,
                          delay: 0.5 + i * 0.1,
                          ease: "easeOut",
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs tabular-nums text-on-surface-variant">
                      {value}/{sub.max}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Expand for detailed feedback */}
            <button
              onClick={() => setExpandedIndex(isExpanded ? null : i)}
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? "Hide" : "Show"} detailed feedback for ${cat.label}`}
              className="mt-4 flex w-full items-center justify-center gap-1 text-xs text-on-surface-variant transition-colors hover:text-on-surface"
            >
              {isExpanded ? "Hide" : "Show"} detailed feedback
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  isExpanded && "rotate-180"
                )}
              />
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <p className="mt-3 border-t border-outline-variant/10 pt-3 text-xs leading-relaxed text-on-surface-variant">
                    {feedback.detailedFeedback[cat.feedbackKey]}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
