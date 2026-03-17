"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Flame } from "lucide-react";
import { PillSelector } from "./pill-selector";
import { ReactiveResponse } from "./reactive-response";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import fireAnimation from "../../../public/lottie/fire.json";

interface CommitmentStepProps {
  selected: number | null;
  onSelect: (minutes: number) => void;
  onNext: () => void;
}

export function CommitmentStep({
  selected,
  onSelect,
  onNext,
}: CommitmentStepProps) {
  const t = useTranslations("onboarding");
  const th = useTranslations("dashboard.home");
  const tReactive = useTranslations("onboarding.reactive_responses");
  const [localSelected, setLocalSelected] = useState<number | null>(null);
  const [reactiveText, setReactiveText] = useState<string | null>(null);
  const advanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const OPTIONS = [
    { label: `5 ${t("commitment.minutes_label")}`, value: 5 },
    { label: `10 ${t("commitment.minutes_label")}`, value: 10 },
    { label: `15 ${t("commitment.minutes_label")}`, value: 15 },
    { label: `20+ ${t("commitment.minutes_label")}`, value: 20 },
  ];

  const dayLabels = [
    th("days_labels.mon"),
    th("days_labels.tue"),
    th("days_labels.wed"),
    th("days_labels.thu"),
    th("days_labels.fri"),
    th("days_labels.sat"),
    th("days_labels.sun"),
  ];

  // Reset state when step mounts/remounts (fixes back button issue)
  useEffect(() => {
    setLocalSelected(null);
    setReactiveText(null);

    return () => {
      if (advanceTimeout.current) clearTimeout(advanceTimeout.current);
      if (textTimeout.current) clearTimeout(textTimeout.current);
    };
  }, []);

  const handleSelect = (value: number) => {
    if (localSelected !== null) return;
    setLocalSelected(value);
    onSelect(value);

    textTimeout.current = setTimeout(() => {
      setReactiveText(tReactive("dailyCommitment." + String(value)));
    }, 300);

    advanceTimeout.current = setTimeout(() => onNext(), 2000);
  };

  return (
    <div className="text-center">
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-2 text-3xl md:text-4xl font-bold text-on-surface"
      >
        {t("commitment.headline")}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8 text-base md:text-lg text-gray-500"
      >
        {t("commitment.subheadline")}
      </motion.p>

      {/* Streak visualization */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
        className="mb-8 flex items-center justify-center gap-2"
      >
        {dayLabels.map((day, i) => (
          <div key={day} className="flex flex-col items-center gap-1">
            {i < 5 ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <LottieAnimation
                  animationData={fireAnimation}
                  className="w-8 h-8"
                />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                <Flame className="h-5 w-5 text-gray-300" />
              </div>
            )}
            <span className="text-[10px] text-gray-400">{day}</span>
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-4"
      >
        <PillSelector
          options={OPTIONS}
          selected={localSelected}
          onSelect={handleSelect}
          disabled={localSelected !== null}
        />
      </motion.div>

      <ReactiveResponse text={reactiveText} />
    </div>
  );
}
