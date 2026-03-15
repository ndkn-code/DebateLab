"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { SelectionCard } from "./selection-card";

const GOALS = [
  {
    id: "compete",
    emoji: "\u{1F3C6}",
    title: "Win debate competitions",
    description: 'Prepare for Tr\u01B0\u1EDDng Teen and other contests',
  },
  {
    id: "english",
    emoji: "\u{1F4DA}",
    title: "Improve my English speaking",
    description: "Build confidence speaking in English",
  },
  {
    id: "critical",
    emoji: "\u{1F9E0}",
    title: "Think more critically",
    description: "Sharpen your reasoning and arguments",
  },
  {
    id: "interview",
    emoji: "\u{1F393}",
    title: "Prepare for interviews",
    description: "University admissions and scholarships",
  },
  {
    id: "explore",
    emoji: "\u{1F3AF}",
    title: "Just exploring",
    description: "Curious to see what debate is about",
  },
];

interface GoalStepProps {
  selected: string | null;
  onSelect: (goal: string) => void;
  onNext: () => void;
}

export function GoalStep({ selected, onSelect, onNext }: GoalStepProps) {
  const advanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSelect = (id: string) => {
    onSelect(id);
    if (advanceTimeout.current) clearTimeout(advanceTimeout.current);
    advanceTimeout.current = setTimeout(() => onNext(), 500);
  };

  useEffect(() => {
    return () => {
      if (advanceTimeout.current) clearTimeout(advanceTimeout.current);
    };
  }, []);

  return (
    <div>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-center text-2xl font-bold text-on-surface"
      >
        What&apos;s your main goal?
      </motion.h2>

      <div className="space-y-3">
        {GOALS.map((goal, i) => (
          <motion.div
            key={goal.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <SelectionCard
              emoji={goal.emoji}
              title={goal.title}
              description={goal.description}
              selected={selected === goal.id}
              onClick={() => handleSelect(goal.id)}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
