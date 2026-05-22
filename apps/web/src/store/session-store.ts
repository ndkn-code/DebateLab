import { create } from "zustand";
import type {
  AiHighlight,
  ClubPracticeContext,
  DebateTopic,
  DebateRound,
  AiDifficulty,
  PracticeTrack,
  PracticeLanguage,
} from "@/types";
import type { DebateScore } from "@/types/feedback";
import {
  SOLO_PREP_DURATION,
  SOLO_SPEECH_DURATION,
  clampDurationSeconds,
} from "@/lib/practice-durations";
import {
  DEFAULT_PRACTICE_LANGUAGE,
  coercePracticeLanguage,
} from "@/lib/practice-language";
import {
  normalizeRebuttalText,
  normalizeStructuredRebuttalResponse,
} from "@/lib/rebuttal/structured-response";

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

interface SessionDraftSnapshot {
  draftId: string;
  selectedTopic: DebateTopic;
  side: "proposition" | "opposition";
  practiceTrack: PracticeTrack;
  practiceLanguage: PracticeLanguage;
  mode: Mode;
  prepTime: number;
  speechTime: number;
  aiDifficulty: AiDifficulty;
  currentPhase: Phase;
  currentRound: number;
  transcript: string;
  prepNotes: string;
  rounds: DebateRound[];
  sessionStartTime: number | null;
  clubContext?: ClubPracticeContext;
}

interface SessionState {
  // Config
  selectedTopic: DebateTopic | null;
  side: Side;
  practiceTrack: PracticeTrack;
  practiceLanguage: PracticeLanguage;
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
  draftId: string | null;
  clubContext: ClubPracticeContext | null;

  // Full Round data
  currentRound: number;
  rounds: DebateRound[];

  // Actions
  setTopic: (topic: DebateTopic | null) => void;
  setSide: (side: Side) => void;
  setPracticeTrack: (track: PracticeTrack) => void;
  setPracticeLanguage: (language: PracticeLanguage) => void;
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
  setDraftId: (draftId: string | null) => void;
  setClubContext: (context: ClubPracticeContext | null) => void;
  startSession: () => void;
  restoreSessionDraft: (draft: SessionDraftSnapshot) => void;
  resetSession: () => void;

  // Full Round actions
  setCurrentRound: (round: number) => void;
  saveRoundTranscript: (roundNumber: number, transcript: string, duration?: number) => void;
  saveAiRebuttal: (roundNumber: number, aiResponse: string, aiHighlights?: AiHighlight[]) => void;
  advanceToNextRound: () => void;
  getCurrentRoundInfo: () => DebateRound | undefined;
  getAllTranscripts: () => string;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  selectedTopic: null,
  side: "random",
  practiceTrack: "debate",
  practiceLanguage: DEFAULT_PRACTICE_LANGUAGE,
  mode: "full",
  prepTime: SOLO_PREP_DURATION.defaultSeconds,
  speechTime: SOLO_SPEECH_DURATION.defaultSeconds,
  aiHints: true,
  aiDifficulty: "medium",

  currentPhase: "idle",
  transcript: "",
  prepNotes: "",
  feedback: null,
  sessionStartTime: null,
  audioBlob: null,
  audioUrl: null,
  draftId: null,
  clubContext: null,

  currentRound: 1,
  rounds: [],

  setTopic: (topic) => set({ selectedTopic: topic }),
  setSide: (side) => set({ side }),
  setPracticeTrack: (practiceTrack) =>
    set((state) => ({
      practiceTrack,
      mode: practiceTrack === "speaking" ? "quick" : state.mode,
    })),
  setPracticeLanguage: (practiceLanguage) =>
    set({ practiceLanguage: coercePracticeLanguage(practiceLanguage) }),
  setMode: (mode) => set({ mode }),
  setPrepTime: (time) =>
    set({ prepTime: clampDurationSeconds(time, SOLO_PREP_DURATION) }),
  setSpeechTime: (time) =>
    set({ speechTime: clampDurationSeconds(time, SOLO_SPEECH_DURATION) }),
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
  setDraftId: (draftId) => set({ draftId }),
  setClubContext: (clubContext) => set({ clubContext }),
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
        draftId: null,
        side: resolvedSide,
        mode: resolvedMode,
        currentRound: 1,
        rounds,
      };
    }),
  restoreSessionDraft: (draft) =>
    set({
      selectedTopic: draft.selectedTopic,
      side: draft.side,
      practiceTrack: draft.practiceTrack,
      practiceLanguage: coercePracticeLanguage(draft.practiceLanguage),
      mode: draft.mode,
      prepTime: clampDurationSeconds(draft.prepTime, SOLO_PREP_DURATION),
      speechTime: clampDurationSeconds(draft.speechTime, SOLO_SPEECH_DURATION),
      aiDifficulty: draft.aiDifficulty,
      currentPhase: draft.currentPhase,
      currentRound: draft.currentRound,
      transcript: draft.transcript,
      prepNotes: draft.prepNotes,
      rounds: draft.rounds,
      sessionStartTime: draft.sessionStartTime,
      draftId: draft.draftId,
      clubContext: draft.clubContext ?? null,
      feedback: null,
      audioBlob: null,
      audioUrl: null,
    }),
  resetSession: () =>
    set({
      selectedTopic: null,
      side: "random",
      practiceTrack: "debate",
      practiceLanguage: DEFAULT_PRACTICE_LANGUAGE,
      mode: "full",
      prepTime: SOLO_PREP_DURATION.defaultSeconds,
      speechTime: SOLO_SPEECH_DURATION.defaultSeconds,
      aiHints: true,
      aiDifficulty: "medium",
      currentPhase: "idle",
      transcript: "",
      prepNotes: "",
      feedback: null,
      sessionStartTime: null,
      audioBlob: null,
      audioUrl: null,
      draftId: null,
      clubContext: null,
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

  saveAiRebuttal: (roundNumber, aiResponse, aiHighlights) =>
    set((state) => {
      const normalized = normalizeStructuredRebuttalResponse(
        aiResponse,
        aiHighlights
      );
      return {
        rounds: state.rounds.map((r) =>
          r.roundNumber === roundNumber
            ? {
                ...r,
                aiResponse: normalized.rebuttal,
                aiHighlights: normalized.highlights,
              }
            : r
        ),
      };
    }),

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
          return `[AI - ${r.label}]\n${normalizeRebuttalText(r.aiResponse)}`;
        }
        return null;
      })
      .filter(Boolean)
      .join("\n\n");
  },
}));
