"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { SelectionCard } from "./selection-card";
import { ReactiveResponse } from "./reactive-response";

const GOAL_IDS = ["compete", "english", "critical", "interview", "explore"];
const GOAL_EMOJIS: Record<string, string> = {
  compete: "\u{1F3C6}",
  english: "\u{1F4DA}",
  critical: "\u{1F9E0}",
  interview: "\u{1F393}",
  explore: "\u{1F3AF}",
};

interface GoalStepProps {
  onSelect: (goal: string) => void;
  onNext: () => void;
}

export function GoalStep({ onSelect, onNext }: GoalStepProps) {
  const t = useTranslations("onboarding");
  const tReactive = useTranslations("onboarding.reactive_responses");
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const [reactiveText, setReactiveText] = useState<string | null>(null);
  const advanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimeout.current) clearTimeout(advanceTimeout.current);
      if (textTimeout.current) clearTimeout(textTimeout.current);
    };
  }, []);

  const handleSelect = (id: string) => {
    if (localSelected !== null) return;
    setLocalSelected(id);
    onSelect(id);

    textTimeout.current = setTimeout(() => {
      setReactiveText(tReactive("goal." + id));
    }, 300);

    advanceTimeout.current = setTimeout(() => onNext(), 2000);
  };

  return (
    <div>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-center text-3xl md:text-4xl font-bold text-on-surface"
      >
        {t("goal.headline")}
      </motion.h2>

      <div className="space-y-3">
        {GOAL_IDS.map((id, i) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <SelectionCard
              emoji={GOAL_EMOJIS[id]}
              title={t("goal.options." + id + ".title")}
              selected={localSelected === id}
              disabled={localSelected !== null}
              onClick={() => handleSelect(id)}
            />
          </motion.div>
        ))}
      </div>

      <ReactiveResponse text={reactiveText} />
    </div>
  );
}
