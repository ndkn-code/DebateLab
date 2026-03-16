"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { PillSelector } from "./pill-selector";
import { ReactiveResponse } from "./reactive-response";
import { REACTIVE_RESPONSES } from "./reactive-responses";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import fireAnimation from "../../../public/lottie/fire.json";

const OPTIONS = [
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "20+ min", value: 20 },
];

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
  const [localSelected, setLocalSelected] = useState<number | null>(selected);
  const [reactiveText, setReactiveText] = useState<string | null>(null);
  const advanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSelect = (value: number) => {
    if (localSelected !== null) return;
    setLocalSelected(value);
    onSelect(value);

    textTimeout.current = setTimeout(() => {
      setReactiveText(
        REACTIVE_RESPONSES.dailyCommitment[String(value)] ?? null
      );
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
    <div className="text-center">
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-2 text-2xl font-bold text-on-surface"
      >
        How much time can you practice each day?
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8 text-gray-500"
      >
        Even 10 minutes a day builds real skill
      </motion.p>

      {/* Streak visualization */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
        className="mb-8 flex items-center justify-center gap-2"
      >
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => (
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
