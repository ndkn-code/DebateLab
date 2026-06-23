"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Lock } from "@/components/ui/icons";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import emptyAnimation from "../../../public/lottie/empty-search.json";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AchievementData } from "./profile-content";

interface AchievementGridProps {
  achievements: AchievementData[];
}

function sortAchievements(achievements: AchievementData[]): AchievementData[] {
  return [...achievements].sort((a, b) => {
    // Unlocked first, sorted by most recently unlocked
    if (a.unlocked && b.unlocked) {
      return (
        new Date(b.unlocked_at!).getTime() - new Date(a.unlocked_at!).getTime()
      );
    }
    if (a.unlocked) return -1;
    if (b.unlocked) return 1;
    // Locked sorted by sort_order (closest to unlocking first)
    return a.sort_order - b.sort_order;
  });
}

export function AchievementGrid({ achievements }: AchievementGridProps) {
  const [showAll, setShowAll] = useState(false);
  const t = useTranslations("dashboard.profile");
  const locale = useLocale();

  const formatDate = (iso: string): string => {
    return new Date(iso).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;
  const sorted = sortAchievements(achievements);
  const visible = showAll ? sorted : sorted.slice(0, 6);

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-token-card md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-on-surface">{t("achievements_title")}</h2>
        <span className="text-sm text-on-surface-variant">
          {t("unlocked_count", { count: unlockedCount, total: totalCount })}
        </span>
      </div>

      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <LottieAnimation animationData={emptyAnimation} className="w-32 h-32 mb-2" />
          <p className="text-sm text-on-surface-variant">{t("no_achievements")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visible.map((a) => (
              <div
                key={a.id}
                className={cn(
                  "rounded-xl p-3 transition-colors",
                  a.unlocked
                    ? "border border-outline-variant bg-surface-container-lowest"
                    : "border border-dashed border-outline-variant opacity-50"
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg",
                      a.unlocked ? "bg-surface-container" : "grayscale bg-surface-container"
                    )}
                  >
                    {a.unlocked ? a.icon : <Lock className="h-4 w-4 text-muted-foreground" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        a.unlocked ? "text-on-surface" : "text-on-surface-variant"
                      )}
                    >
                      {a.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {a.description}
                    </p>
                    {a.unlocked && a.unlocked_at && (
                      <p className="mt-1 type-caption text-on-surface-variant">
                        {t("unlocked_date", { date: formatDate(a.unlocked_at) })}
                      </p>
                    )}
                    {a.title_reward && a.unlocked && (
                      <p className="mt-0.5 type-caption text-on-surface-variant">
                        {t("title_reward", { title: a.title_reward })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalCount > 6 && !showAll && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAll(true)}
              >
                {t("view_all", { count: totalCount })}
              </Button>
            </div>
          )}

          {showAll && totalCount > 6 && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAll(false)}
              >
                {t("show_less")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
