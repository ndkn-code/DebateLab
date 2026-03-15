"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { SelectionCard } from "./selection-card";

const LEVELS = [
  {
    id: "beginner",
    emoji: "\u{1F331}",
    title: "Beginner",
    description: "I've never debated formally",
  },
  {
    id: "intermediate",
    emoji: "\u{1F4D6}",
    title: "Some experience",
    description: "A few debates in class or clubs",
  },
  {
    id: "experienced",
    emoji: "\u{1F3C5}",
    title: "Experienced",
    description: "I compete in tournaments",
  },
];

interface ExperienceStepProps {
  selected: string | null;
  onSelect: (level: string) => void;
  onNext: () => void;
}

export function ExperienceStep({
  selected,
  onSelect,
  onNext,
}: ExperienceStepProps) {
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
        How much debate experience do you have?
      </motion.h2>

      <div className="space-y-3">
        {LEVELS.map((level, i) => (
          <motion.div
            key={level.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <SelectionCard
              emoji={level.emoji}
              title={level.title}
              description={level.description}
              selected={selected === level.id}
              onClick={() => handleSelect(level.id)}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
