"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import thinkingAnimation from "../../../public/lottie/thinking.json";

const TIPS = [
  "Strong debaters always address counter-arguments before their opponent brings them up.",
  "The best introductions start with a hook — a question, a surprising fact, or a bold statement.",
  "Using signposting phrases like 'My first argument is...' helps judges follow your structure.",
  "Speak slowly and clearly — judges value clarity over speed.",
  "The most persuasive speakers use concrete examples rather than abstract claims.",
  "A strong conclusion doesn't just summarize — it leaves the audience with something to think about.",
  "Practice the 'Rule of Three': three main arguments is the sweet spot for most debates.",
  "Transition phrases like 'Furthermore' and 'In contrast' make your speech flow smoothly.",
];

export function LoadingState() {
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(
    Math.floor(Math.random() * TIPS.length)
  );

  // Fake progress: 0→90% over ~8s
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + Math.random() * 4;
      });
    }, 300);
    return () => clearInterval(interval);
  }, []);

  // Rotate tips
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
      {/* Thinking brain animation */}
      <div className="mb-8">
        <LottieAnimation
          animationData={thinkingAnimation}
          className="w-32 h-32"
        />
      </div>

      <h2 className="mb-2 text-xl font-bold text-on-surface">
        Analyzing your debate performance...
      </h2>
      <p className="mb-8 text-sm text-on-surface-variant">
        Our AI is reviewing your arguments, structure, and language
      </p>

      {/* Progress bar */}
      <div className="mb-8 h-1.5 w-64 overflow-hidden rounded-full bg-surface-container-high">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: "0%" }}
          animate={{ width: `${Math.min(progress, 95)}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Debate tip */}
      <motion.div
        key={tipIndex}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="max-w-md text-center"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-primary/60">
          Debate Tip
        </p>
        <p className="mt-2 text-sm text-on-surface-variant">{TIPS[tipIndex]}</p>
      </motion.div>
    </div>
  );
}
