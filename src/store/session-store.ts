import { create } from "zustand";
import type { DebateTopic, DebateRound, AiDifficulty, PracticeTrack } from "@/types";
import type { DebateScore } from "@/types/feedback";

export type Side = "proposition" | "opposition" | "random";
export type Mode = "quick" | "full";
export type Phase =
  | "idle"
  | "mic-check"
  | "prep"
  | "speaking"
  | "ai-rebuttal"
  | "analyzing"
  | "feedback";

/** Full Round has 5 rounds in Trường Teen style */
export const FULL_ROUND_STRUCTURE: Omit<DebateRound, "transcript" | "aiResponse" | "duration">[] = [
  { roundNumber: 1, type: "user-speech", label: "Opening Statement" },
  { roundNumber: 2, type: "ai-rebuttal", label: "AI Rebuttal" },
  { roundNumber: 3, type: "user-speech", label: "Counter-Rebuttal" },
  { roundNumber: 4, type: "ai-rebuttal", label: "AI Closing" },
  { roundNumber: 5, type: "user-speech", label: "Closing Statement" },
];

interface SessionState {
  // Config
  selectedTopic: DebateTopic | null;
  side: Side;
  practiceTrack: PracticeTrack;
  mode: Mode;
  prepTime: number;
  speechTime: number;
  aiHints: boolean;
  aiDifficulty: AiDifficulty;

  // Session data
  currentPhase: Phase;
  transcript: string;
  prepNotes: string;
  feedback: DebateScore | null;
  sessionStartTime: number | null;
  audioBlob: Blob | null;
  audioUrl: string | null;

  // Full Round data
  currentRound: number;
  rounds: DebateRound[];

  // Actions
  setTopic: (topic: DebateTopic | null) => void;
  setSide: (side: Side) => void;
  setPracticeTrack: (track: PracticeTrack) => void;
  setMode: (mode: Mode) => void;
  setPrepTime: (time: number) => void;
  setSpeechTime: (time: number) => void;
  setAiHints: (on: boolean) => void;
  setAiDifficulty: (difficulty: AiDifficulty) => void;
  setPhase: (phase: Phase) => void;
  setTranscript: (text: string) => void;
  appendTranscript: (text: string) => void;
  setPrepNotes: (notes: string) => void;
  setFeedback: (feedback: DebateScore) => void;
  setAudioBlob: (blob: Blob | null) => void;
  setAudioUrl: (url: string | null) => void;
  startSession: () => void;
  resetSession: () => void;

  // Full Round actions
  setCurrentRound: (round: number) => void;
  saveRoundTranscript: (roundNumber: number, transcript: string, duration?: number) => void;
  saveAiRebuttal: (roundNumber: number, aiResponse: string) => void;
  advanceToNextRound: () => void;
  getCurrentRoundInfo: () => DebateRound | undefined;
  getAllTranscripts: () => string;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  selectedTopic: null,
  side: "random",
  practiceTrack: "debate",
  mode: "full",
  prepTime: 120,
  speechTime: 120,
  aiHints: true,
  aiDifficulty: "medium",

  currentPhase: "idle",
  transcript: "",
  prepNotes: "",
  feedback: null,
  sessionStartTime: null,
  audioBlob: null,
  audioUrl: null,

  currentRound: 1,
  rounds: [],

  setTopic: (topic) => set({ selectedTopic: topic }),
  setSide: (side) => set({ side }),
  setPracticeTrack: (practiceTrack) =>
    set((state) => ({
      practiceTrack,
      mode: practiceTrack === "speaking" ? "quick" : state.mode,
    })),
  setMode: (mode) => set({ mode }),
  setPrepTime: (time) => set({ prepTime: time }),
  setSpeechTime: (time) => set({ speechTime: time }),
  setAiHints: (on) => set({ aiHints: on }),
  setAiDifficulty: (difficulty) => set({ aiDifficulty: difficulty }),
  setPhase: (phase) => set({ currentPhase: phase }),
  setTranscript: (text) => set({ transcript: text }),
  appendTranscript: (text) =>
    set((state) => ({ transcript: state.transcript + text })),
  setPrepNotes: (notes) => set({ prepNotes: notes }),
  setFeedback: (feedback) => set({ feedback }),
  setAudioBlob: (blob) => set({ audioBlob: blob }),
  setAudioUrl: (url) => set({ audioUrl: url }),
  startSession: () =>
    set((state) => {
      const resolvedSide =
        state.side === "random"
          ? Math.random() > 0.5
            ? "proposition"
            : "opposition"
          : state.side;

      const resolvedMode = state.practiceTrack === "speaking" ? "quick" : state.mode;
      const rounds: DebateRound[] =
        state.practiceTrack === "debate" && resolvedMode === "full"
          ? FULL_ROUND_STRUCTURE.map((r) => ({ ...r }))
          : [];

      return {
        currentPhase: "mic-check",
        sessionStartTime: Date.now(),
        transcript: "",
        prepNotes: "",
        feedback: null,
        audioBlob: null,
        audioUrl: null,
        side: resolvedSide,
        mode: resolvedMode,
        currentRound: 1,
        rounds,
      };
    }),
  resetSession: () =>
    set({
      selectedTopic: null,
      side: "random",
      practiceTrack: "debate",
      mode: "full",
      prepTime: 120,
      speechTime: 120,
      aiHints: true,
      aiDifficulty: "medium",
      currentPhase: "idle",
      transcript: "",
      prepNotes: "",
      feedback: null,
      sessionStartTime: null,
      audioBlob: null,
      audioUrl: null,
      currentRound: 1,
      rounds: [],
    }),

  setCurrentRound: (round) => set({ currentRound: round }),

  saveRoundTranscript: (roundNumber, transcript, duration) =>
    set((state) => ({
      rounds: state.rounds.map((r) =>
        r.roundNumber === roundNumber ? { ...r, transcript, duration } : r
      ),
    })),

  saveAiRebuttal: (roundNumber, aiResponse) =>
    set((state) => ({
      rounds: state.rounds.map((r) =>
        r.roundNumber === roundNumber ? { ...r, aiResponse } : r
      ),
    })),

  advanceToNextRound: () =>
    set((state) => ({
      currentRound: state.currentRound + 1,
      transcript: "",
    })),

  getCurrentRoundInfo: () => {
    const state = get();
    return state.rounds.find((r) => r.roundNumber === state.currentRound);
  },

  getAllTranscripts: () => {
    const state = get();
    return state.rounds
      .map((r) => {
        if (r.type === "user-speech" && r.transcript) {
          return `[${r.label}]\n${r.transcript}`;
        }
        if (r.type === "ai-rebuttal" && r.aiResponse) {
          return `[AI - ${r.label}]\n${r.aiResponse}`;
        }
        return null;
      })
      .filter(Boolean)
      .join("\n\n");
  },
}));
