import { create } from "zustand";
import type { DebateTopic, DebateSession, PracticeTrack } from "@/types";

interface DebateState {
  sessions: DebateSession[];
  currentTopic: DebateTopic | null;
  currentSide: "proposition" | "opposition";
  currentPracticeTrack: PracticeTrack;
  currentMode: "quick" | "full";
  setCurrentTopic: (topic: DebateTopic | null) => void;
  setCurrentSide: (side: "proposition" | "opposition") => void;
  setCurrentPracticeTrack: (track: PracticeTrack) => void;
  setCurrentMode: (mode: "quick" | "full") => void;
  addSession: (session: DebateSession) => void;
}

export const useDebateStore = create<DebateState>((set) => ({
  sessions: [],
  currentTopic: null,
  currentSide: "proposition",
  currentPracticeTrack: "debate",
  currentMode: "full",
  setCurrentTopic: (topic) => set({ currentTopic: topic }),
  setCurrentSide: (side) => set({ currentSide: side }),
  setCurrentPracticeTrack: (currentPracticeTrack) => set({ currentPracticeTrack }),
  setCurrentMode: (mode) => set({ currentMode: mode }),
  addSession: (session) =>
    set((state) => ({ sessions: [session, ...state.sessions] })),
}));
