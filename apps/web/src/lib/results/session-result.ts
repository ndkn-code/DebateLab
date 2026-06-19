import {
  computeSkillSnapshot,
  type SkillMetricKey,
} from "@/lib/analytics/skill-snapshot";
import {
  getSkillKeysForTrack,
  scoreOutOfHundred,
  SKILL_UI_META,
} from "@/lib/analytics/skill-metadata";
import {
  richNotesToPlainText,
  toRichNotesHtml,
} from "@/lib/practice-notes";
import type {
  DebateSession,
  DebateScore,
  DebateRound,
  PracticeActionStep,
  PracticeTrack,
  ShadowExample,
} from "@/types";

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
  prepNotes: {
    html: string;
    plainText: string;
    wordCount: number;
  } | null;
  improvementPlan: PracticeActionStep[];
  shadowExamples: ShadowExample[];
  transcript: string;
  rounds: DebateRound[];
}

export type FullRoundWinnerResult =
  | {
      kind: "side";
      side: DebateSession["side"];
      confidence: number;
    }
  | {
      kind: "tie";
      confidence: number;
    };

function getOppositeSide(side: DebateSession["side"]): DebateSession["side"] {
  return side === "proposition" ? "opposition" : "proposition";
}

export function getFullRoundWinnerResult(
  session: DebateSession,
  practiceTrack: PracticeTrack = session.feedback?.practiceTrack ??
    session.practiceTrack ??
    "debate"
): FullRoundWinnerResult | null {
  const verdict = session.feedback?.debateVerdict;
  if (practiceTrack !== "debate" || session.mode !== "full" || !verdict) {
    return null;
  }

  if (verdict.winner === "tie") {
    return {
      kind: "tie",
      confidence: verdict.confidence,
    };
  }

  return {
    kind: "side",
    side:
      verdict.winner === "user" ? session.side : getOppositeSide(session.side),
    confidence: verdict.confidence,
  };
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

function countWords(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function buildPrepNotesViewModel(prepNotes?: string | null) {
  const plainText = richNotesToPlainText(prepNotes ?? "").trim();
  if (!plainText) return null;

  return {
    html: toRichNotesHtml(prepNotes ?? ""),
    plainText,
    wordCount: countWords(plainText),
  };
}

function buildFallbackImprovementPlan(
  feedback: DebateScore,
  practiceTrack: PracticeTrack
): PracticeActionStep[] {
  const existing = feedback.improvementPlan ?? [];
  if (existing.length > 0) return existing.slice(0, 3);

  const scoreSteps = feedback.scoreRationale
    ? [
        feedback.scoreRationale.content.nextStep,
        feedback.scoreRationale.structure.nextStep,
        feedback.scoreRationale.persuasion.nextStep,
      ]
    : [];
  const sourceItems = [
    ...scoreSteps,
    ...(feedback.missingLayers ?? []),
    ...(feedback.improvements ?? []),
  ]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));
  const uniqueItems = Array.from(new Set(sourceItems)).slice(0, 3);

  return uniqueItems.map((item, index) => ({
    title:
      practiceTrack === "speaking"
        ? `Speaking drill ${index + 1}`
        : `Debate drill ${index + 1}`,
    whyItMatters:
      practiceTrack === "speaking"
        ? "This turns feedback into one repeatable speaking habit."
        : "This turns feedback into one repeatable debating habit.",
    howToPractice: item,
    shadowExample:
      feedback.strongerRebuilds?.[index] ??
      feedback.sampleArguments?.[index] ??
      undefined,
    timeBoxSeconds: 120,
  }));
}

function buildShadowExamples(
  feedback: DebateScore,
  modelAnswer: string | null,
  practiceTrack: PracticeTrack
) {
  const existing = feedback.shadowExamples ?? [];
  if (existing.length > 0) return existing.slice(0, 3);

  const examples = [
    ...(feedback.strongerRebuilds ?? []),
    ...(feedback.sampleArguments ?? []),
    modelAnswer,
  ]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));
  const uniqueExamples = Array.from(new Set(examples)).slice(0, 2);

  return uniqueExamples.map((after, index) => ({
    label:
      practiceTrack === "speaking"
        ? `Shadow line ${index + 1}`
        : `Shadow argument ${index + 1}`,
    after,
    why:
      practiceTrack === "speaking"
        ? "It gives you a clearer sentence shape to speak aloud and adapt."
        : "It gives you a clearer claim, mechanism, and impact shape to imitate.",
  }));
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
    prepNotes: buildPrepNotesViewModel(session.prepNotes),
    improvementPlan: buildFallbackImprovementPlan(feedback, practiceTrack),
    shadowExamples: buildShadowExamples(
      feedback,
      modelAnswer.value,
      practiceTrack
    ),
    transcript: session.transcript,
    rounds: session.rounds ?? [],
  };
}
