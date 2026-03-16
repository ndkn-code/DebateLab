"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { SelectionCard } from "./selection-card";
import { ReactiveResponse } from "./reactive-response";

const LEVEL_IDS = ["beginner", "intermediate", "experienced"];
const LEVEL_EMOJIS: Record<string, string> = {
  beginner: "\u{1F331}",
  intermediate: "\u{1F4D6}",
  experienced: "\u{1F3C5}",
};

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
  const t = useTranslations("onboarding");
  const tReactive = useTranslations("onboarding.reactive_responses");
  const [localSelected, setLocalSelected] = useState<string | null>(selected);
  const [reactiveText, setReactiveText] = useState<string | null>(null);
  const advanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSelect = (id: string) => {
    if (localSelected !== null) return;
    setLocalSelected(id);
    onSelect(id);

    textTimeout.current = setTimeout(() => {
      setReactiveText(tReactive("experience." + id));
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
        {t("experience.headline")}
      </motion.h2>

      <div className="space-y-3">
        {LEVEL_IDS.map((id, i) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <SelectionCard
              emoji={LEVEL_EMOJIS[id]}
              title={t("experience.options." + id + ".title")}
              description={t("experience.options." + id + ".description")}
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
