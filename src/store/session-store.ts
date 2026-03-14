import { create } from "zustand";
import type { DebateTopic } from "@/types";
import type { DebateScore } from "@/types/feedback";

export type Side = "proposition" | "opposition" | "random";
export type Mode = "quick" | "full";
export type Phase = "idle" | "prep" | "speaking" | "analyzing" | "feedback";

interface SessionState {
  // Config
  selectedTopic: DebateTopic | null;
  side: Side;
  mode: Mode;
  prepTime: number;
  speechTime: number;
  aiHints: boolean;

  // Session data
  currentPhase: Phase;
  transcript: string;
  prepNotes: string;
  feedback: DebateScore | null;
  sessionStartTime: number | null;
  audioBlob: Blob | null;
  audioUrl: string | null;

  // Actions
  setTopic: (topic: DebateTopic | null) => void;
  setSide: (side: Side) => void;
  setMode: (mode: Mode) => void;
  setPrepTime: (time: number) => void;
  setSpeechTime: (time: number) => void;
  setAiHints: (on: boolean) => void;
  setPhase: (phase: Phase) => void;
  setTranscript: (text: string) => void;
  appendTranscript: (text: string) => void;
  setPrepNotes: (notes: string) => void;
  setFeedback: (feedback: DebateScore) => void;
  setAudioBlob: (blob: Blob | null) => void;
  setAudioUrl: (url: string | null) => void;
  startSession: () => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  selectedTopic: null,
  side: "random",
  mode: "full",
  prepTime: 120,
  speechTime: 120,
  aiHints: true,

  currentPhase: "idle",
  transcript: "",
  prepNotes: "",
  feedback: null,
  sessionStartTime: null,
  audioBlob: null,
  audioUrl: null,

  setTopic: (topic) => set({ selectedTopic: topic }),
  setSide: (side) => set({ side }),
  setMode: (mode) => set({ mode }),
  setPrepTime: (time) => set({ prepTime: time }),
  setSpeechTime: (time) => set({ speechTime: time }),
  setAiHints: (on) => set({ aiHints: on }),
  setPhase: (phase) => set({ currentPhase: phase }),
  setTranscript: (text) => set({ transcript: text }),
  appendTranscript: (text) =>
    set((state) => ({ transcript: state.transcript + text })),
  setPrepNotes: (notes) => set({ prepNotes: notes }),
  setFeedback: (feedback) => set({ feedback }),
  setAudioBlob: (blob) => set({ audioBlob: blob }),
  setAudioUrl: (url) => set({ audioUrl: url }),
  startSession: () =>
    set((state) => ({
      currentPhase: "prep",
      sessionStartTime: Date.now(),
      transcript: "",
      prepNotes: "",
      feedback: null,
      audioBlob: null,
      audioUrl: null,
      side:
        state.side === "random"
          ? Math.random() > 0.5
            ? "proposition"
            : "opposition"
          : state.side,
    })),
  resetSession: () =>
    set({
      selectedTopic: null,
      side: "random",
      mode: "full",
      prepTime: 120,
      speechTime: 120,
      aiHints: true,
      currentPhase: "idle",
      transcript: "",
      prepNotes: "",
      feedback: null,
      sessionStartTime: null,
      audioBlob: null,
      audioUrl: null,
    }),
}));
