"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { DebateTopic } from "@/types";

interface TopicCardProps {
  topic: DebateTopic;
  isSelected: boolean;
  onSelect: (topic: DebateTopic) => void;
  index: number;
}

export function TopicCard({ topic, isSelected, onSelect, index }: TopicCardProps) {
  const t = useTranslations("dashboard.practice");

  const difficultyConfig = {
    beginner: { label: t("difficulty_beginner"), color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    intermediate: { label: t("difficulty_intermediate"), color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    advanced: { label: t("difficulty_advanced"), color: "bg-red-500/10 text-red-400 border-red-500/20" },
  };

  const diff = difficultyConfig[topic.difficulty];

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      onClick={() => onSelect(topic)}
      className={cn(
        "group w-full rounded-xl border p-5 text-left transition-all duration-200",
        isSelected
          ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/5"
          : "border-outline-variant/10 bg-surface-container-lowest hover:border-outline-variant/30 hover:bg-surface-container-lowest"
      )}
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
          {topic.category}
        </span>
        <span className={cn("rounded-md border px-2 py-0.5 text-xs", diff.color)}>
          {diff.label}
        </span>
      </div>

      <h3
        className={cn(
          "text-[15px] font-semibold leading-snug transition-colors",
          isSelected ? "text-primary" : "text-on-surface group-hover:text-on-surface"
        )}
      >
        {topic.title}
      </h3>

      {topic.context && (
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant line-clamp-2">
          {topic.context}
        </p>
      )}
    </motion.button>
  );
}
