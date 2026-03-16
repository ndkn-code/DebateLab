"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { SelectionCard } from "./selection-card";
import { ReactiveResponse } from "./reactive-response";
import { REACTIVE_RESPONSES } from "./reactive-responses";

const LEVELS = [
  {
    id: "low",
    emoji: "\u{1F605}",
    title: "Not very confident",
    description: "I mostly speak Vietnamese",
  },
  {
    id: "okay",
    emoji: "\u{1F642}",
    title: "Okay",
    description: "I can express basic ideas",
  },
  {
    id: "good",
    emoji: "\u{1F60A}",
    title: "Good",
    description: "I'm comfortable in English",
  },
  {
    id: "high",
    emoji: "\u{1F525}",
    title: "Very confident",
    description: "English feels natural to me",
  },
];

interface EnglishStepProps {
  selected: string | null;
  onSelect: (confidence: string) => void;
  onNext: () => void;
}

export function EnglishStep({
  selected,
  onSelect,
  onNext,
}: EnglishStepProps) {
  const [localSelected, setLocalSelected] = useState<string | null>(selected);
  const [reactiveText, setReactiveText] = useState<string | null>(null);
  const advanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSelect = (id: string) => {
    if (localSelected !== null) return;
    setLocalSelected(id);
    onSelect(id);

    textTimeout.current = setTimeout(() => {
      setReactiveText(REACTIVE_RESPONSES.englishConfidence[id] ?? null);
    }, 300);

    advanceTimeout.current = setTimeout(() => onNext(), 2000);
  };

  useEffect(() => {
    return () => {
      if (advanceTimeout.current) clearTimeout(advanceTimeout.current);
      if (textTimeout.current) clearTimeout(textTimeout.current);
    };
  }, []);

  return (
    <div>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-center text-2xl font-bold text-on-surface"
      >
        How confident are you debating in English?
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
              selected={localSelected === level.id}
              disabled={localSelected !== null}
              onClick={() => handleSelect(level.id)}
            />
          </motion.div>
        ))}
      </div>

      <ReactiveResponse text={reactiveText} />
    </div>
  );
}
