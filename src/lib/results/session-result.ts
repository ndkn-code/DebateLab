import {
  computeSkillSnapshot,
  type SkillMetricKey,
} from "@/lib/analytics/skill-snapshot";
import {
  getSkillKeysForTrack,
  scoreOutOfHundred,
  SKILL_UI_META,
} from "@/lib/analytics/skill-metadata";
import type { DebateSession, DebateScore, DebateRound, PracticeTrack } from "@/types";

export interface SessionResultMetric {
  key: SkillMetricKey;
  score: number;
  valueOutOf100: number;
  accentHex: string;
  dotClassName: string;
  progressClassName: string;
  softClassName: string;
  chipClassName: string;
  descriptionKey: string;
}

export interface SessionResultHighlight {
  metric: SessionResultMetric | null;
  note: string | null;
}

export interface SessionResultViewModel {
  feedback: DebateScore;
  practiceTrack: PracticeTrack;
  metrics: SessionResultMetric[];
  strongest: SessionResultHighlight;
  weakest: SessionResultHighlight;
  focus: SessionResultHighlight;
  strengths: string[];
  improvements: string[];
  modelAnswer: string | null;
  modelAnswerKind: "stronger-rebuild" | "model-answer" | "summary";
  transcript: string;
  rounds: DebateRound[];
}

function pickModelAnswer(feedback: DebateScore) {
  const strongerRebuild = feedback.strongerRebuilds?.find(Boolean);
  if (strongerRebuild) {
    return {
      value: strongerRebuild,
      kind: "stronger-rebuild" as const,
    };
  }

  const betterVersion = feedback.argumentBreakdowns?.find(Boolean)?.betterVersion;
  if (betterVersion) {
    return {
      value: betterVersion,
      kind: "stronger-rebuild" as const,
    };
  }

  const sampleArgument = feedback.sampleArguments?.find(Boolean);
  if (sampleArgument) {
    return {
      value: sampleArgument,
      kind: "model-answer" as const,
    };
  }

  return {
    value: feedback.summary,
    kind: "summary" as const,
  };
}

function buildMetricList(feedback: DebateScore, practiceTrack: PracticeTrack) {
  const snapshot = computeSkillSnapshot([{ feedback }]);
  const orderedKeys = getSkillKeysForTrack(practiceTrack);

  return orderedKeys
    .map((key) => {
      const snapshotMetric = snapshot.metrics.find((metric) => metric.key === key);
      if (!snapshotMetric) {
        return null;
      }

      const meta = SKILL_UI_META[key];
      return {
        key,
        score: scoreOutOfHundred(snapshotMetric.value),
        valueOutOf100: snapshotMetric.value,
        accentHex: meta.accentHex,
        dotClassName: meta.dotClassName,
        progressClassName: meta.progressClassName,
        softClassName: meta.softClassName,
        chipClassName: meta.chipClassName,
        descriptionKey: meta.descriptionKey,
      };
    })
    .filter(Boolean) as SessionResultMetric[];
}

export function buildSessionResultViewModel(
  session: DebateSession
): SessionResultViewModel | null {
  if (!session.feedback) {
    return null;
  }

  const feedback = session.feedback;
  const practiceTrack = feedback.practiceTrack ?? session.practiceTrack ?? "debate";
  const metrics = buildMetricList(feedback, practiceTrack);
  const sortedMetrics = [...metrics].sort((left, right) => left.score - right.score);
  const improvements =
    feedback.missingLayers && feedback.missingLayers.length > 0
      ? feedback.missingLayers
      : feedback.improvements;
  const modelAnswer = pickModelAnswer(feedback);

  return {
    feedback,
    practiceTrack,
    metrics,
    strongest: {
      metric: sortedMetrics.at(-1) ?? null,
      note: feedback.strengths[0] ?? feedback.summary,
    },
    weakest: {
      metric: sortedMetrics[0] ?? null,
      note: improvements[0] ?? feedback.summary,
    },
    focus: {
      metric: sortedMetrics[0] ?? null,
      note: improvements[1] ?? modelAnswer.value ?? feedback.summary,
    },
    strengths: feedback.strengths,
    improvements,
    modelAnswer: modelAnswer.value,
    modelAnswerKind: modelAnswer.kind,
    transcript: session.transcript,
    rounds: session.rounds ?? [],
  };
}
