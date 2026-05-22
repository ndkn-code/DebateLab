import { create } from "zustand";

interface AchievementInfo {
  title: string;
  description: string;
  icon: string;
  titleReward?: string;
}

interface AchievementStore {
  pendingAchievement: AchievementInfo | null;
  showAchievement: (achievement: AchievementInfo) => void;
  dismissAchievement: () => void;
  levelUp: number | null;
  showLevelUp: (level: number) => void;
  dismissLevelUp: () => void;
}

export const useAchievementStore = create<AchievementStore>((set) => ({
  pendingAchievement: null,
  showAchievement: (achievement) => set({ pendingAchievement: achievement }),
  dismissAchievement: () => set({ pendingAchievement: null }),
  levelUp: null,
  showLevelUp: (level) => set({ levelUp: level }),
  dismissLevelUp: () => set({ levelUp: null }),
}));
