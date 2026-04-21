"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Star, BookOpen, ArrowRight, ArrowLeft } from "lucide-react";
import confetti from "canvas-confetti";
import { Link } from "@/i18n/navigation";

interface Props {
  moduleTitle: string;
  moduleTotalXP: number;
  activitiesCompleted: number;
  nextModuleTitle?: string;
  courseId: string;
  nextModuleFirstActivityId?: string;
  isLastModule: boolean;
  courseOverviewHref?: string;
  nextModuleHref?: string;
}

export function ModuleCompletionScreen({
  moduleTitle,
  moduleTotalXP,
  activitiesCompleted,
  nextModuleTitle,
  courseId,
  nextModuleFirstActivityId,
  isLastModule,
  courseOverviewHref,
  nextModuleHref,
}: Props) {
  const t = useTranslations("courses.player");
  const [displayXP, setDisplayXP] = useState(0);

  useEffect(() => {
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });
    setTimeout(() => confetti({ particleCount: 60, spread: 60, origin: { x: 0.3, y: 0.6 } }), 500);
    setTimeout(() => confetti({ particleCount: 60, spread: 60, origin: { x: 0.7, y: 0.6 } }), 800);
  }, []);

  useEffect(() => {
    if (moduleTotalXP <= 0) return;
    let frame: number;
    const duration = 1200;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayXP(Math.round(progress * moduleTotalXP));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [moduleTotalXP]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 20 }}
        className="flex flex-col items-center w-full max-w-sm"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="text-7xl mb-4"
        >
          🎉
        </motion.div>

        <h2 className="text-3xl font-extrabold text-on-surface mb-1">{t("moduleComplete")}</h2>
        <p className="text-lg text-on-surface-variant">&ldquo;{moduleTitle}&rdquo;</p>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="w-full rounded-2xl bg-white border border-gray-100 shadow-sm p-6 mt-6 space-y-3"
        >
          <div className="flex items-center justify-center gap-2">
            <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
            <span className="text-2xl font-extrabold text-amber-600">{displayXP} XP</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-on-surface-variant">
            <BookOpen className="h-4 w-4" />
            <span className="text-sm">{activitiesCompleted} activities completed</span>
          </div>
        </motion.div>

        {nextModuleTitle && !isLastModule && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-4 text-center"
          >
            <p className="text-sm text-green-600 font-semibold">
              🔓 {t("moduleUnlocked", { moduleName: nextModuleTitle })}
            </p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="flex flex-col gap-3 mt-6 w-full"
        >
          {nextModuleFirstActivityId && !isLastModule && (
            <Link
              href={nextModuleHref ?? `/dashboard/courses/${courseId}/activity/${nextModuleFirstActivityId}`}
              className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-base font-semibold text-on-primary hover:bg-primary/90 transition-colors"
            >
              {t("continueToModule", { moduleName: nextModuleTitle ?? "Next" })}
              <ArrowRight className="h-5 w-5" />
            </Link>
          )}
          <Link
            href={courseOverviewHref ?? `/dashboard/courses/${courseId}`}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 px-6 py-3 text-base font-medium text-on-surface-variant hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("backToCourseOverview")}
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
