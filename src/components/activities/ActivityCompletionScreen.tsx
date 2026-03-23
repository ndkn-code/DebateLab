"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Star, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";
import type { ActivityType } from "@/lib/types/admin";

interface Props {
  activityTitle: string;
  activityType: ActivityType;
  score: number;
  maxScore: number;
  xpEarned: number;
  onContinue: () => void;
  nextActivityTitle?: string;
}

const MESSAGES = {
  perfect: ["Perfect! You nailed it! 🎯", "Flawless! Amazing work! ✨", "100%! You're on fire! 🔥"],
  great: ["Great job! Almost perfect!", "Impressive work! Keep going!", "Nearly there! Well done!"],
  good: ["Good effort! Keep practicing!", "Nice progress! You're learning!", "Solid attempt!"],
  low: ["Nice try! Review and try again.", "Keep at it! Practice makes perfect.", "Don't give up! Try again!"],
};

export function ActivityCompletionScreen({
  activityTitle,
  activityType,
  score,
  maxScore,
  xpEarned,
  onContinue,
  nextActivityTitle,
}: Props) {
  const t = useTranslations("courses.player");
  const [displayXP, setDisplayXP] = useState(0);
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 100;
  const isPerfect = score === maxScore;

  // XP count-up animation
  useEffect(() => {
    if (xpEarned <= 0) return;
    let frame: number;
    const duration = 1000;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayXP(Math.round(progress * xpEarned));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [xpEarned]);

  // Confetti for perfect score
  useEffect(() => {
    if (isPerfect) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }
  }, [isPerfect]);

  const getMessage = () => {
    const pool = pct === 100 ? MESSAGES.perfect : pct >= 80 ? MESSAGES.great : pct >= 60 ? MESSAGES.good : MESSAGES.low;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 200 }}
        className="flex flex-col items-center w-full max-w-sm"
      >
        {/* Emoji */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", damping: 15 }}
          className="text-6xl mb-4"
        >
          {isPerfect ? "🏆" : pct >= 80 ? "⭐" : pct >= 60 ? "👏" : "💪"}
        </motion.div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-on-surface mb-2">{t("activityComplete")}</h2>

        {/* Stats card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="w-full rounded-2xl bg-white border border-gray-100 shadow-sm p-6 mt-4 space-y-4"
        >
          {/* XP */}
          <div className="flex items-center justify-center gap-2">
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ delay: 1.2, duration: 0.4 }}
            >
              <Star className="h-7 w-7 fill-amber-400 text-amber-400" />
            </motion.div>
            <span className="text-3xl font-extrabold text-amber-600">+{displayXP} XP</span>
          </div>

          {/* Score */}
          {maxScore > 0 && activityType !== "lesson" && (
            <div className="text-center">
              <p className="text-lg font-semibold text-on-surface">
                {t("score", { score, total: maxScore })}
              </p>
              <p className="text-sm text-on-surface-variant">{pct}%</p>
            </div>
          )}
        </motion.div>

        {/* Message */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-base text-on-surface-variant mt-4 text-center"
        >
          {getMessage()}
        </motion.p>

        {/* Next activity preview */}
        {nextActivityTitle && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-sm text-on-surface-variant mt-3"
          >
            {t("upNext", { title: nextActivityTitle })}
          </motion.p>
        )}

        {/* Continue button */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          onClick={onContinue}
          className="mt-6 flex items-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-base font-semibold text-on-primary hover:bg-primary/90 transition-colors"
          whileTap={{ scale: 0.97 }}
        >
          {t("continue")}
          <ArrowRight className="h-5 w-5" />
        </motion.button>
      </motion.div>
    </div>
  );
}
