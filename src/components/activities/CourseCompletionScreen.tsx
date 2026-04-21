"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Star, BookOpen, Layers } from "lucide-react";
import confetti from "canvas-confetti";
import { Link } from "@/i18n/navigation";

interface Props {
  courseTitle: string;
  totalXP: number;
  totalActivities: number;
  totalModules: number;
  previewMode?: boolean;
  courseOverviewHref?: string;
  editorHref?: string;
}

export function CourseCompletionScreen({
  courseTitle,
  totalXP,
  totalActivities,
  totalModules,
  previewMode = false,
  courseOverviewHref,
  editorHref,
}: Props) {
  const t = useTranslations("courses.player");
  const [displayXP, setDisplayXP] = useState(0);

  useEffect(() => {
    const burst = () => {
      confetti({ particleCount: 100, spread: 100, origin: { y: 0.4 } });
    };
    burst();
    const t1 = setTimeout(burst, 600);
    const t2 = setTimeout(burst, 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (totalXP <= 0) return;
    let frame: number;
    const duration = 1500;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayXP(Math.round(progress * totalXP));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [totalXP]);

  const stats = [
    { icon: Star, label: "XP", value: displayXP, color: "text-amber-600", fill: "fill-amber-400 text-amber-400" },
    { icon: BookOpen, label: "Activities", value: totalActivities, color: "text-blue-600", fill: "text-blue-500" },
    { icon: Layers, label: "Modules", value: totalModules, color: "text-purple-600", fill: "text-purple-500" },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 20 }}
        className="flex flex-col items-center w-full max-w-md"
      >
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: "spring", damping: 12 }}
          className="text-8xl mb-6"
        >
          🏆
        </motion.div>

        <h2 className="text-3xl font-extrabold text-on-surface mb-1">{t("courseComplete")}</h2>
        <p className="text-lg text-on-surface-variant text-center">&ldquo;{courseTitle}&rdquo;</p>

        {/* Stats */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-3 gap-3 w-full mt-8"
        >
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 + i * 0.15 }}
                className="flex flex-col items-center rounded-2xl bg-white border border-gray-100 shadow-sm p-4"
              >
                <Icon className={`h-6 w-6 ${stat.fill} mb-2`} />
                <span className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</span>
                <span className="text-xs text-on-surface-variant">{stat.label}</span>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-base text-on-surface-variant mt-6 text-center"
        >
          🎓 {t("youMastered")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="flex flex-col gap-3 mt-6 w-full"
        >
          {previewMode ? (
            <>
              <Link
                href={courseOverviewHref ?? "/dashboard/courses"}
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-base font-semibold text-on-primary hover:bg-primary/90 transition-colors"
              >
                {t("backToCourseOverview")}
              </Link>
              <Link
                href={editorHref ?? "/dashboard/admin/courses"}
                className="flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 px-6 py-3 text-base font-medium text-on-surface-variant hover:bg-gray-50 transition-colors"
              >
                {t("backToEditor")}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/dashboard/courses"
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-base font-semibold text-on-primary hover:bg-primary/90 transition-colors"
              >
                {t("exploreMore")} →
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 px-6 py-3 text-base font-medium text-on-surface-variant hover:bg-gray-50 transition-colors"
              >
                {t("backToDashboard")}
              </Link>
            </>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
