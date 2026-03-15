"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface SelectionCardProps {
  emoji: string;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

export function SelectionCard({
  emoji,
  title,
  description,
  selected,
  onClick,
}: SelectionCardProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative flex w-full items-center gap-4 rounded-2xl border-2 bg-white p-4 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-gray-200 hover:border-primary/40 hover:shadow-md"
      }`}
    >
      <span className="text-2xl">{emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-on-surface">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary"
        >
          <Check className="h-3.5 w-3.5 text-white" />
        </motion.div>
      )}
    </motion.button>
  );
}
