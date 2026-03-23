import { create } from 'zustand';

interface ActivityPlayerState {
  isActivityMode: boolean;
  sessionXP: number;
  currentModuleId: string | null;
  completedActivityIds: string[];
  enterActivityMode: () => void;
  exitActivityMode: () => void;
  addSessionXP: (amount: number) => void;
  markActivityCompleted: (id: string) => void;
  resetSession: () => void;
}

export const useActivityPlayerStore = create<ActivityPlayerState>((set) => ({
  isActivityMode: false,
  sessionXP: 0,
  currentModuleId: null,
  completedActivityIds: [],
  enterActivityMode: () => set({ isActivityMode: true }),
  exitActivityMode: () => set({ isActivityMode: false, sessionXP: 0, completedActivityIds: [] }),
  addSessionXP: (amount) => set((s) => ({ sessionXP: s.sessionXP + amount })),
  markActivityCompleted: (id) =>
    set((s) => ({
      completedActivityIds: s.completedActivityIds.includes(id)
        ? s.completedActivityIds
        : [...s.completedActivityIds, id],
    })),
  resetSession: () => set({ sessionXP: 0, completedActivityIds: [], currentModuleId: null }),
}));
