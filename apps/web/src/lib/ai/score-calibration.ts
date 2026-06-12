import type { AiQualityTelemetry } from "@/lib/ai/quality-model";
import type { DebateScore } from "@/types";

type DepthCompletionMetadata = {
  scoreBefore?: unknown;
  scoreAfter?: unknown;
  scoreCapReasons?: unknown;
};

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function getDepthCompletion(
  telemetry: AiQualityTelemetry | null | undefined
): DepthCompletionMetadata | null {
  const metadata = telemetry?.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const depthCompletion = metadata.depthCompletion;
  return depthCompletion &&
    typeof depthCompletion === "object" &&
    !Array.isArray(depthCompletion)
    ? (depthCompletion as DepthCompletionMetadata)
    : null;
}

export function createScoreCalibrationMetadata(
  feedback: DebateScore,
  telemetry: AiQualityTelemetry | null | undefined
) {
  const depthCompletion = getDepthCompletion(telemetry);
  const feedbackCalibration = feedback.scoreCalibrationMetadata;
  const softCapReasons = Array.from(
    new Set([
      ...(feedbackCalibration?.scoreCapReasons ?? []),
      ...readStringArray(depthCompletion?.scoreCapReasons),
    ])
  );
  const scoreBefore =
    readNumber(feedbackCalibration?.scoreBefore) ??
    readNumber(depthCompletion?.scoreBefore) ??
    feedback.totalScore;
  const scoreAfter =
    readNumber(feedbackCalibration?.scoreAfter) ??
    readNumber(depthCompletion?.scoreAfter) ??
    feedback.totalScore;

  return {
    scoreBefore,
    scoreAfter,
    scoreDelta: scoreAfter - scoreBefore,
    softCapReasons,
  };
}
