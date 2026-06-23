"use client";

import { useTranslations } from "next-intl";
import { Flame, Sparkles, Trophy, Zap } from "@/components/ui/icons";
import {
  HeatmapCells,
  HeatmapChart,
  HeatmapInteractionBoundary,
  HeatmapInteractionProvider,
  HeatmapLegend,
  HeatmapTooltip,
} from "@/components/charts";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { cn } from "@/lib/utils";
import type { DailyStatEntry } from "@/lib/api/dashboard";
import fireAnimation from "../../../public/lottie/fire.json";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const STREAK_HEATMAP_LEVELS = [
  "var(--color-surface-container-high)",
  "var(--color-chart-4)",
  "var(--color-chart-4)",
  "var(--color-chart-3)",
  "var(--color-chart-3)",
] as const;

function streakHeatmapColorScale(count: number | null | undefined) {
  const level = Math.max(0, Math.min(4, Math.round(count ?? 0)));
  return STREAK_HEATMAP_LEVELS[level] ?? STREAK_HEATMAP_LEVELS[0];
}

function getStreakMessageKey(streak: number) {
  if (streak <= 0) return "zero";
  if (streak < 4) return "building";
  if (streak < 7) return "steady";
  return "on_fire";
}

function toHeatmapDate(date: string) {
  return new Date(`${date}T12:00:00`);
}

function getHeatmapCount(entry: DailyStatEntry) {
  if (entry.practice_minutes <= 0 && entry.sessions_completed <= 0) return 0;
  return Math.min(4, 1 + entry.sessions_completed + Math.floor(entry.practice_minutes / 20));
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
  const heatmapData = weeklyStats.map((entry, index) => ({
    bin: index,
    bins: [
      {
        bin: 0,
        count: getHeatmapCount(entry),
        date: toHeatmapDate(entry.date),
      },
    ],
  }));

  return (
    <section
      className={cn(
        "relative min-w-0 overflow-hidden rounded-[2rem] border border-warning-container bg-[linear-gradient(135deg,var(--color-reward-container)_0%,var(--color-surface-container-lowest)_55%,var(--color-surface-container)_100%)] soft-shadow dark:border-warning-container/70",
        compact ? "p-5" : "p-6 sm:p-7"
      )}
    >
      <div className="absolute inset-x-[-10%] top-[-22%] h-48 rounded-full bg-reward/10 blur-3xl" />
      <div className="absolute bottom-[-25%] right-[-8%] h-44 w-44 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative">
        <div
          className={cn(
            "flex gap-5 min-w-0",
            compact
              ? "items-start justify-between"
              : "flex-col sm:flex-row sm:items-start sm:justify-between"
          )}
        >
          <div className={cn("min-w-0", compact ? "flex-1" : "max-w-xl")}>
            <span className="type-eyebrow inline-flex items-center gap-2 rounded-full border border-warning-container bg-surface-container-lowest/80 px-3 py-1 text-reward-dim backdrop-blur-sm dark:border-warning-container/70 dark:bg-warning-container/60 dark:text-warning">
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
              "shrink-0 flex items-center justify-center border border-outline-variant/40 bg-surface-container-lowest/75 shadow-token-card backdrop-blur-sm dark:border-outline-variant/70 dark:bg-surface/75",
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
                  compact ? "h-8 w-8 text-reward/70" : "h-10 w-10 text-reward/70"
                )}
              />
            )}
          </div>
        </div>

        <div
          className={cn(
            "grid gap-3 min-w-0",
            compact ? "mt-4 grid-cols-2" : "mt-6 sm:grid-cols-2"
          )}
        >
          <div
            className={cn(
              "rounded-[1.25rem] border border-outline-variant/40 bg-surface-container-lowest/75 backdrop-blur-sm dark:border-outline-variant/70 dark:bg-surface/75",
              compact ? "p-3" : "p-4"
            )}
          >
            <div className="type-eyebrow flex items-center gap-2 text-reward-dim">
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
              "rounded-[1.25rem] border border-outline-variant/40 bg-surface-container-lowest/75 backdrop-blur-sm dark:border-outline-variant/70 dark:bg-surface/75",
              compact ? "p-3" : "p-4"
            )}
          >
            <div className="type-eyebrow flex items-center gap-2 text-primary">
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
            "rounded-[1.5rem] border border-outline-variant/40 bg-surface-container-lowest/80 backdrop-blur-sm dark:border-outline-variant/70 dark:bg-surface/80",
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

          <HeatmapInteractionProvider>
            <HeatmapInteractionBoundary>
              <div className="flex flex-col gap-2">
                <HeatmapChart
                  data={heatmapData}
                  layout="fill"
                  levelColors={STREAK_HEATMAP_LEVELS}
                  margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                  gap={compact ? 4 : 6}
                  className={compact ? "h-9 w-full" : "h-12 w-full"}
                >
                  <HeatmapCells cornerRadius={compact ? 6 : 8} />
                  <HeatmapTooltip
                    formatLabel={(count, date) =>
                      count > 0
                        ? t("active_days_this_week", { count: 1 })
                        : date.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })
                    }
                  />
                </HeatmapChart>
                <div className={cn("grid min-w-0 grid-cols-7", compact ? "gap-1" : "gap-2")}>
                  {weeklyStats.map((entry, index) => {
                    const isToday = entry.date === today;
                    return (
                      <span
                        key={entry.date}
                        className={cn(
                          compact ? "type-caption leading-none" : "type-caption",
                          "text-center",
                          isToday ? "text-on-surface" : "text-on-surface-variant"
                        )}
                      >
                        {t(`days_labels.${DAY_KEYS[index]}`)}
                      </span>
                    );
                  })}
                </div>
                <HeatmapLegend
                  colorScale={streakHeatmapColorScale}
                  lessLabel=""
                  moreLabel=""
                  align="center"
                  cellSize={compact ? 8 : 10}
                />
              </div>
            </HeatmapInteractionBoundary>
          </HeatmapInteractionProvider>
        </div>
      </div>
    </section>
  );
}
