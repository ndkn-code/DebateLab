"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { DebateTopic } from "@/types";

const difficultyConfig = {
  beginner: { label: "Beginner", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  intermediate: { label: "Intermediate", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  advanced: { label: "Advanced", color: "bg-red-500/10 text-red-400 border-red-500/20" },
};

interface TopicCardProps {
  topic: DebateTopic;
  isSelected: boolean;
  onSelect: (topic: DebateTopic) => void;
  index: number;
}

export function TopicCard({ topic, isSelected, onSelect, index }: TopicCardProps) {
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
          ? "border-blue-500/50 bg-blue-500/5 shadow-lg shadow-blue-500/5"
          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900"
      )}
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
          {topic.category}
        </span>
        <span className={cn("rounded-md border px-2 py-0.5 text-xs", diff.color)}>
          {diff.label}
        </span>
      </div>

      <h3
        className={cn(
          "text-[15px] font-semibold leading-snug transition-colors",
          isSelected ? "text-blue-100" : "text-zinc-100 group-hover:text-white"
        )}
      >
        {topic.title}
      </h3>

      {topic.context && (
        <p className="mt-2 text-xs leading-relaxed text-zinc-500 line-clamp-2">
          {topic.context}
        </p>
      )}
    </motion.button>
  );
}
