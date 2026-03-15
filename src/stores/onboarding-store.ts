import { create } from "zustand";

interface OnboardingFeedback {
  score: number;
  strength: string;
  improvement: string;
  encouragement: string;
}

interface OnboardingState {
  currentStep: number;
  goal: string | null;
  experienceLevel: string | null;
  englishConfidence: string | null;
  dailyGoalMinutes: number | null;
  demoTopic: string;
  demoPosition: "FOR" | "AGAINST";
  demoTranscript: string | null;
  demoFeedback: OnboardingFeedback | null;
  setGoal: (goal: string) => void;
  setExperienceLevel: (level: string) => void;
  setEnglishConfidence: (confidence: string) => void;
  setDailyGoalMinutes: (minutes: number) => void;
  setDemoTranscript: (transcript: string) => void;
  setDemoFeedback: (feedback: OnboardingFeedback) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipToStep: (step: number) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  currentStep: 0,
  goal: null,
  experienceLevel: null,
  englishConfidence: null,
  dailyGoalMinutes: null,
  demoTopic: "Social media does more harm than good for teenagers",
  demoPosition: Math.random() > 0.5 ? "FOR" : "AGAINST",
  demoTranscript: null,
  demoFeedback: null,
  setGoal: (goal) => set({ goal }),
  setExperienceLevel: (level) => set({ experienceLevel: level }),
  setEnglishConfidence: (confidence) => set({ englishConfidence: confidence }),
  setDailyGoalMinutes: (minutes) => set({ dailyGoalMinutes: minutes }),
  setDemoTranscript: (transcript) => set({ demoTranscript: transcript }),
  setDemoFeedback: (feedback) => set({ demoFeedback: feedback }),
  nextStep: () => set((s) => ({ currentStep: s.currentStep + 1 })),
  prevStep: () =>
    set((s) => ({ currentStep: Math.max(0, s.currentStep - 1) })),
  skipToStep: (step) => set({ currentStep: step }),
  reset: () =>
    set({
      currentStep: 0,
      goal: null,
      experienceLevel: null,
      englishConfidence: null,
      dailyGoalMinutes: null,
      demoTranscript: null,
      demoFeedback: null,
    }),
}));
