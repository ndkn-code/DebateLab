import { create } from "zustand";
import type { DebateTopic, DebateSession } from "@/types";

interface DebateState {
  sessions: DebateSession[];
  currentTopic: DebateTopic | null;
  currentSide: "proposition" | "opposition";
  currentMode: "quick" | "full";
  setCurrentTopic: (topic: DebateTopic | null) => void;
  setCurrentSide: (side: "proposition" | "opposition") => void;
  setCurrentMode: (mode: "quick" | "full") => void;
  addSession: (session: DebateSession) => void;
}

export const useDebateStore = create<DebateState>((set) => ({
  sessions: [],
  currentTopic: null,
  currentSide: "proposition",
  currentMode: "full",
  setCurrentTopic: (topic) => set({ currentTopic: topic }),
  setCurrentSide: (side) => set({ currentSide: side }),
  setCurrentMode: (mode) => set({ currentMode: mode }),
  addSession: (session) =>
    set((state) => ({ sessions: [session, ...state.sessions] })),
}));
