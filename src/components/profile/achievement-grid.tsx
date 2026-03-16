"use client";

import { useState } from "react";
import { Trophy, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AchievementData } from "./profile-content";

interface AchievementGridProps {
  achievements: AchievementData[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;
  const sorted = sortAchievements(achievements);
  const visible = showAll ? sorted : sorted.slice(0, 6);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Achievements</h2>
        <span className="text-sm text-gray-500">
          {unlockedCount}/{totalCount} unlocked
        </span>
      </div>

      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">No achievements yet</p>
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
                    ? "border border-gray-200 bg-white"
                    : "border border-dashed border-gray-300 opacity-50"
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg",
                      a.unlocked ? "bg-amber-50" : "grayscale bg-gray-50"
                    )}
                  >
                    {a.unlocked ? a.icon : <Lock className="h-4 w-4 text-gray-400" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        a.unlocked ? "text-gray-900" : "text-gray-500"
                      )}
                    >
                      {a.title}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">
                      {a.description}
                    </p>
                    {a.unlocked && a.unlocked_at && (
                      <p className="mt-1 text-[11px] text-emerald-600">
                        Unlocked {formatDate(a.unlocked_at)}
                      </p>
                    )}
                    {a.title_reward && a.unlocked && (
                      <p className="mt-0.5 text-[11px] font-medium text-amber-600">
                        Title: &ldquo;{a.title_reward}&rdquo;
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
                View All ({totalCount})
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
                Show Less
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
