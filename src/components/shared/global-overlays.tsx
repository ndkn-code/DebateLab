"use client";

import { useAchievementStore } from "@/stores/achievement-store";
import { AchievementToast } from "@/components/ui/achievement-toast";
import { LevelUpOverlay } from "@/components/ui/level-up-overlay";

export function GlobalOverlays() {
  const {
    pendingAchievement,
    dismissAchievement,
    levelUp,
    dismissLevelUp,
  } = useAchievementStore();

  return (
    <>
      <AchievementToast
        achievement={pendingAchievement}
        onDismiss={dismissAchievement}
      />
      <LevelUpOverlay newLevel={levelUp} onDismiss={dismissLevelUp} />
    </>
  );
}
