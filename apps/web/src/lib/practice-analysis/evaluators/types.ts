import type { DebateScore } from "@/types/feedback";
import type { PracticeAnalysisInput } from "../types";

export interface PracticeFeedbackEvaluator {
  key: string;
  evaluate(input: PracticeAnalysisInput, userId?: string): Promise<DebateScore>;
}
