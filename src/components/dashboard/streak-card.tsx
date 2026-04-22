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
  compact?: boolean;
}

export function StreakCard({
  streak,
  longestStreak,
  weeklyStats,
  compact = false,
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
    <section
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-amber-500/15 bg-gradient-to-br from-[#fff6e9] via-surface-container-lowest to-[#fffdf8] soft-shadow",
        compact ? "p-5" : "p-6 sm:p-7"
      )}
    >
      <div className="absolute inset-x-[-10%] top-[-22%] h-48 rounded-full bg-amber-300/10 blur-3xl" />
      <div className="absolute bottom-[-25%] right-[-8%] h-44 w-44 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative">
        <div
          className={cn(
            "flex gap-5",
            compact
              ? "items-start justify-between"
              : "flex-col sm:flex-row sm:items-start sm:justify-between"
          )}
        >
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/15 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              {t("streak_title")}
            </span>

            <div className={cn("flex items-end gap-3", compact ? "mt-3" : "mt-4")}>
              <span
                className={cn(
                  "font-black tracking-tight text-on-surface",
                  compact ? "text-4xl sm:text-5xl" : "text-5xl sm:text-6xl"
                )}
              >
                {streak}
              </span>
              <span
                className={cn(
                  "font-medium text-on-surface-variant",
                  compact ? "pb-1 text-xs" : "pb-2 text-sm"
                )}
              >
                {t("days")}
              </span>
            </div>

            <p
              className={cn(
                "max-w-lg text-on-surface-variant",
                compact
                  ? "mt-2 text-xs leading-5 sm:text-sm"
                  : "mt-3 text-sm leading-6 sm:text-base"
              )}
            >
              {t(`streak_messages.${messageKey}`, { count: streak })}
            </p>
          </div>

          <div
            className={cn(
              "flex items-center justify-center border border-white/70 bg-white/75 shadow-sm backdrop-blur-sm",
              compact
                ? "h-16 w-16 rounded-[1.25rem] sm:h-20 sm:w-20"
                : "h-20 w-20 rounded-[1.5rem] sm:h-24 sm:w-24"
            )}
          >
            {streak > 0 ? (
              <LottieAnimation
                animationData={fireAnimation}
                className={cn(
                  compact ? "h-12 w-12 sm:h-16 sm:w-16" : "h-16 w-16 sm:h-20 sm:w-20"
                )}
                loop
              />
            ) : (
              <Flame
                className={cn(
                  compact ? "h-8 w-8 text-amber-400/70" : "h-10 w-10 text-amber-400/70"
                )}
              />
            )}
          </div>
        </div>

        <div className={cn("grid gap-3 sm:grid-cols-2", compact ? "mt-4" : "mt-6")}>
          <div
            className={cn(
              "rounded-[1.25rem] border border-white/70 bg-white/75 backdrop-blur-sm",
              compact ? "p-3" : "p-4"
            )}
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
              <Trophy className="h-4 w-4" />
              {t("best_run")}
            </div>
            <p className={cn("font-bold text-on-surface", compact ? "mt-2 text-xl" : "mt-3 text-2xl")}>
              {longestStreak}
              <span className={cn("ml-2 font-medium text-on-surface-variant", compact ? "text-xs" : "text-sm")}>
                {t("days")}
              </span>
            </p>
          </div>

          <div
            className={cn(
              "rounded-[1.25rem] border border-white/70 bg-white/75 backdrop-blur-sm",
              compact ? "p-3" : "p-4"
            )}
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              <Zap className="h-4 w-4" />
              {t("week_activity")}
            </div>
            <p className={cn("font-bold text-on-surface", compact ? "mt-2 text-xl" : "mt-3 text-2xl")}>
              {activeDays}/7
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              {t("week_minutes", { count: totalMinutes })}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-[1.5rem] border border-white/70 bg-white/80 backdrop-blur-sm",
            compact ? "mt-4 p-3.5" : "mt-6 p-4"
          )}
        >
          <div className={cn("flex items-center justify-between gap-3", compact ? "mb-3" : "mb-4")}>
            <div>
              <p className={cn("font-semibold text-on-surface", compact ? "text-xs" : "text-sm")}>
                {t("streak_week_title")}
              </p>
              <p className="text-xs text-on-surface-variant">
                {t("active_days_this_week", { count: activeDays })}
              </p>
            </div>
          </div>

          <div className={cn("grid grid-cols-7", compact ? "gap-1.5" : "gap-2")}>
            {weeklyStats.map((entry, index) => {
              const isActive =
                entry.practice_minutes > 0 || entry.sessions_completed > 0;
              const isToday = entry.date === today;

              return (
                <div key={entry.date} className="flex flex-col items-center gap-2">
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-full border text-sm transition-colors",
                      compact
                        ? "h-9 w-9 sm:h-10 sm:w-10"
                        : "h-11 w-11 sm:h-12 sm:w-12",
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
                      compact ? "text-[11px] font-medium" : "text-xs font-medium",
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
