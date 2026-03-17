"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { SelectionCard } from "./selection-card";
import { ReactiveResponse } from "./reactive-response";

const LEVEL_IDS = ["low", "okay", "good", "high"];
const LEVEL_EMOJIS: Record<string, string> = {
  low: "\u{1F605}",
  okay: "\u{1F642}",
  good: "\u{1F60A}",
  high: "\u{1F525}",
};

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
  const t = useTranslations("onboarding");
  const tReactive = useTranslations("onboarding.reactive_responses");
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const [reactiveText, setReactiveText] = useState<string | null>(null);
  const advanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when step mounts/remounts (fixes back button issue)
  useEffect(() => {
    setLocalSelected(null);
    setReactiveText(null);

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
      setReactiveText(tReactive("englishConfidence." + id));
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
        {t("english.headline")}
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
              title={t("english.options." + id + ".title")}
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
