"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import trophyAnimation from "../../../public/lottie/trophy.json";

interface Achievement {
  title: string;
  description: string;
  icon: string;
  titleReward?: string;
}

interface AchievementToastProps {
  achievement: Achievement | null;
  onDismiss: () => void;
}

export function AchievementToast({
  achievement,
  onDismiss,
}: AchievementToastProps) {
  useEffect(() => {
    if (achievement) {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [achievement, onDismiss]);

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.9 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90vw] max-w-md"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 p-4 flex items-center gap-4">
            <div className="flex-shrink-0">
              <LottieAnimation
                animationData={trophyAnimation}
                className="w-14 h-14"
                loop={false}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                Achievement Unlocked!
              </p>
              <p className="font-bold text-gray-900 truncate">
                {achievement.icon} {achievement.title}
              </p>
              <p className="text-sm text-gray-500 truncate">
                {achievement.description}
              </p>
              {achievement.titleReward && (
                <p className="text-xs text-amber-500 mt-1">
                  New title unlocked: &ldquo;{achievement.titleReward}&rdquo;
                </p>
              )}
            </div>
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none flex-shrink-0"
            >
              &times;
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
