"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import levelUpAnimation from "../../../public/lottie/levelup.json";
import confettiAnimation from "../../../public/lottie/confetti.json";

interface LevelUpOverlayProps {
  newLevel: number | null;
  onDismiss: () => void;
}

export function LevelUpOverlay({ newLevel, onDismiss }: LevelUpOverlayProps) {
  const t = useTranslations('achievements');

  useEffect(() => {
    if (newLevel !== null) {
      const timer = setTimeout(onDismiss, 4000);
      return () => clearTimeout(timer);
    }
  }, [newLevel, onDismiss]);

  return (
    <AnimatePresence>
      {newLevel !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-[110]"
          onClick={onDismiss}
        >
          {/* Confetti background */}
          <div className="absolute inset-0">
            <LottieAnimation
              animationData={confettiAnimation}
              loop={false}
              className="w-full h-full"
            />
          </div>

          {/* Level up center */}
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              damping: 12,
              stiffness: 200,
              delay: 0.2,
            }}
            className="text-center relative z-10"
          >
            <LottieAnimation
              animationData={levelUpAnimation}
              className="w-48 h-48 mx-auto"
              loop={false}
            />
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-3xl font-bold text-primary mt-2"
            >
              {t('level_up', { level: newLevel })}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-gray-500 mt-1"
            >
              {t('level_up_subtitle')}
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
