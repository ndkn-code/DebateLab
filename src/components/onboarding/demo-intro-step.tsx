"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DemoIntroStepProps {
  topic: string;
  position: "FOR" | "AGAINST";
  onNext: () => void;
}

export function DemoIntroStep({
  topic,
  position,
  onNext,
}: DemoIntroStepProps) {
  return (
    <div className="text-center">
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-2 text-2xl font-bold text-on-surface"
      >
        Let&apos;s try a quick debate!
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8 text-gray-500"
      >
        You&apos;ll get 30 seconds to argue your position. Don&apos;t worry
        &mdash; this is just practice!
      </motion.p>

      {/* Topic card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-md"
      >
        <p className="mb-4 text-lg font-semibold text-on-surface">{topic}</p>
        <span
          className={`inline-block rounded-full px-4 py-1.5 text-sm font-bold ${
            position === "FOR"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-rose-100 text-rose-700"
          }`}
        >
          {position}
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Button
          onClick={onNext}
          className="gap-2 rounded-xl bg-primary px-8 py-3 text-lg font-semibold text-white"
          size="lg"
        >
          I&apos;m ready
          <ArrowRight className="h-5 w-5" />
        </Button>
      </motion.div>
    </div>
  );
}
