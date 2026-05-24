import type { DebateScore } from "@/types/feedback";
import type { AiQualityTelemetry } from "@/lib/ai/quality-model";
import type { PracticeAnalysisInput } from "../types";

export type PracticeFeedbackTelemetryCallback = (
  telemetry: AiQualityTelemetry
) => void | Promise<void>;

export interface PracticeFeedbackEvaluator {
  key: string;
  evaluate(
    input: PracticeAnalysisInput,
    userId?: string,
    onTelemetry?: PracticeFeedbackTelemetryCallback
  ): Promise<DebateScore>;
}
