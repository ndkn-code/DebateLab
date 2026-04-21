"use client";

import { useTranslations } from "next-intl";
import { Check, Flame, Sparkles, Trophy, Zap } from "lucide-react";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { cn } from "@/lib/utils";
import type { DailyStatEntry } from "@/lib/api/dashboard";
import fireAnimation from "../../../public/lottie/fire.json";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function getStreakMessageKey(streak: number) {
  if (streak <= 0) return "zero";
  if (streak < 4) return "building";
  if (streak < 7) return "steady";
  return "on_fire";
}

interface StreakCardProps {
  streak: number;
  longestStreak: number;
  weeklyStats: DailyStatEntry[];
}

export function StreakCard({
  streak,
  longestStreak,
  weeklyStats,
}: StreakCardProps) {
  const t = useTranslations("dashboard.home");
  const today = new Date().toISOString().split("T")[0];
  const activeDays = weeklyStats.filter(
    (entry) => entry.practice_minutes > 0 || entry.sessions_completed > 0
  ).length;
  const totalMinutes = weeklyStats.reduce(
    (sum, entry) => sum + entry.practice_minutes,
    0
  );
  const messageKey = getStreakMessageKey(streak);

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-amber-500/15 bg-gradient-to-br from-[#fff6e9] via-surface-container-lowest to-[#fffdf8] p-6 soft-shadow sm:p-7">
      <div className="absolute inset-x-[-10%] top-[-22%] h-48 rounded-full bg-amber-300/10 blur-3xl" />
      <div className="absolute bottom-[-25%] right-[-8%] h-44 w-44 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/15 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              {t("streak_title")}
            </span>

            <div className="mt-4 flex items-end gap-3">
              <span className="text-5xl font-black tracking-tight text-on-surface sm:text-6xl">
                {streak}
              </span>
              <span className="pb-2 text-sm font-medium text-on-surface-variant">
                {t("days")}
              </span>
            </div>

            <p className="mt-3 max-w-lg text-sm leading-6 text-on-surface-variant sm:text-base">
              {t(`streak_messages.${messageKey}`, { count: streak })}
            </p>
          </div>

          <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] border border-white/70 bg-white/75 shadow-sm backdrop-blur-sm sm:h-24 sm:w-24">
            {streak > 0 ? (
              <LottieAnimation
                animationData={fireAnimation}
                className="h-16 w-16 sm:h-20 sm:w-20"
                loop
              />
            ) : (
              <Flame className="h-10 w-10 text-amber-400/70" />
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1.25rem] border border-white/70 bg-white/75 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
              <Trophy className="h-4 w-4" />
              {t("best_run")}
            </div>
            <p className="mt-3 text-2xl font-bold text-on-surface">
              {longestStreak}
              <span className="ml-2 text-sm font-medium text-on-surface-variant">
                {t("days")}
              </span>
            </p>
          </div>

          <div className="rounded-[1.25rem] border border-white/70 bg-white/75 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              <Zap className="h-4 w-4" />
              {t("week_activity")}
            </div>
            <p className="mt-3 text-2xl font-bold text-on-surface">{activeDays}/7</p>
            <p className="mt-1 text-xs text-on-surface-variant">
              {t("week_minutes", { count: totalMinutes })}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-white/70 bg-white/80 p-4 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-on-surface">
                {t("streak_week_title")}
              </p>
              <p className="text-xs text-on-surface-variant">
                {t("active_days_this_week", { count: activeDays })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {weeklyStats.map((entry, index) => {
              const isActive =
                entry.practice_minutes > 0 || entry.sessions_completed > 0;
              const isToday = entry.date === today;

              return (
                <div key={entry.date} className="flex flex-col items-center gap-2">
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full border text-sm transition-colors sm:h-12 sm:w-12",
                      isActive
                        ? "border-primary bg-primary text-on-primary shadow-[0_12px_24px_-16px_rgba(47,79,221,0.65)]"
                        : isToday
                          ? "border-primary/30 bg-primary/5 text-primary"
                          : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant"
                    )}
                  >
                    {isActive ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Zap className="h-4 w-4 opacity-70" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isToday ? "text-on-surface" : "text-on-surface-variant"
                    )}
                  >
                    {t(`days_labels.${DAY_KEYS[index]}`)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
