"use client";

import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { XPAnimation } from "./XPAnimation";
import { useState, useEffect } from "react";

interface ActivitySummary {
  id: string;
  title: string;
  order_index: number;
}

interface Props {
  activities: ActivitySummary[];
  currentActivityId: string;
  completedIds: Set<string>;
  sessionXP: number;
  moduleName: string;
  courseId: string;
}

export function TopProgressBar({
  activities,
  currentActivityId,
  completedIds,
  sessionXP,
  moduleName,
  courseId,
}: Props) {
  const t = useTranslations("courses.player");
  const [showXPAnim, setShowXPAnim] = useState(false);
  const [prevXP, setPrevXP] = useState(sessionXP);

  // Trigger XP animation when sessionXP increases
  useEffect(() => {
    if (sessionXP > prevXP) {
      setShowXPAnim(true);
      setTimeout(() => setShowXPAnim(false), 1500);
      setPrevXP(sessionXP);
    }
  }, [sessionXP, prevXP]);

  const currentIdx = activities.findIndex((a) => a.id === currentActivityId);

  return (
    <div className="sticky top-0 z-40 flex items-center gap-3 bg-white/90 backdrop-blur-xl border-b border-gray-100 px-4 py-3 shadow-sm">
      {/* Back button */}
      <Link
        href={`/dashboard/courses/${courseId}`}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-on-surface-variant hover:bg-gray-100 transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      {/* Progress dots */}
      <div className="flex items-center gap-1.5 flex-1 justify-center">
        {activities.map((act, i) => {
          const isCompleted = completedIds.has(act.id);
          const isCurrent = act.id === currentActivityId;

          return (
            <div key={act.id} className="flex items-center">
              <motion.div
                className={`rounded-full transition-all duration-300 ${
                  isCompleted
                    ? "h-3 w-3 bg-green-500"
                    : isCurrent
                    ? "h-3.5 w-3.5 bg-primary"
                    : "h-2.5 w-2.5 bg-gray-200"
                }`}
                animate={isCurrent ? { scale: [1, 1.2, 1] } : {}}
                transition={isCurrent ? { repeat: Infinity, duration: 2 } : {}}
              />
              {/* Connector line */}
              {i < activities.length - 1 && (
                <div className={`h-0.5 w-3 sm:w-5 mx-0.5 rounded-full ${
                  isCompleted ? "bg-green-500" : "bg-gray-200"
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Module name (desktop only) */}
      <span className="hidden sm:block text-xs font-medium text-on-surface-variant truncate max-w-[120px]">
        {moduleName}
      </span>

      {/* XP counter */}
      <div className="relative flex items-center gap-1 shrink-0">
        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
        <motion.span
          key={sessionXP}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className="text-sm font-bold text-amber-600 min-w-[30px]"
        >
          {sessionXP}
        </motion.span>
        <XPAnimation xp={sessionXP - prevXP + (sessionXP > prevXP ? sessionXP - prevXP : 0)} trigger={showXPAnim} position="top-right" />
      </div>
    </div>
  );
}
