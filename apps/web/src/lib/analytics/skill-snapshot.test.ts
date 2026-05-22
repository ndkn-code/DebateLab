import assert from "node:assert/strict";
import {
  computeSkillSnapshot,
  type SkillFeedbackSource,
} from "./skill-snapshot";
import type { DebateScore, PracticeTrack } from "@/types/feedback";

function score(params: {
  track?: PracticeTrack;
  clarity?: number;
  logic?: number;
  rebuttal?: number;
  evidence?: number;
  delivery?: number;
  total?: number;
}): DebateScore {
  const delivery = params.delivery ?? 8;

  return {
    content: {
      score: 8,
      claimClarity: params.clarity ?? 8,
      evidenceSupport: params.evidence ?? 8,
      logicCoherence: params.logic ?? 8,
      counterArgument: params.rebuttal ?? 8,
    },
    structure: {
      score: 8,
      introduction: 8,
      bodyOrganization: 8,
      conclusion: 8,
    },
    language: {
      score: 8,
      vocabulary: delivery,
      grammar: Math.min(9, delivery),
      fluency: delivery,
    },
    persuasion: {
      score: 8,
      audienceAwareness: 8,
      impactfulness: 8,
    },
    totalScore: params.total ?? 80,
    overallBand: "Competent",
    summary: "Test score",
    strengths: [],
    improvements: [],
    sampleArguments: [],
    practiceTrack: params.track,
    detailedFeedback: {
      contentFeedback: "",
      structureFeedback: "",
      languageFeedback: "",
      persuasionFeedback: "",
    },
  };
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function source(params: {
  feedback: DebateScore | null;
  days?: number;
  mode?: "quick" | "full";
  duration?: number;
  totalScore?: number | null;
  topicDifficulty?: "beginner" | "intermediate" | "advanced";
  aiDifficulty?: "easy" | "medium" | "hard";
}): SkillFeedbackSource {
  return {
    feedback: params.feedback,
    created_at: daysAgo(params.days ?? 0),
    mode: params.mode ?? "full",
    duration_seconds: params.duration ?? 900,
    total_score: params.totalScore === undefined ? 80 : params.totalScore,
    topic_difficulty: params.topicDifficulty,
    ai_difficulty: params.aiDifficulty,
  };
}

function metricValue(snapshot: ReturnType<typeof computeSkillSnapshot>, key: string) {
  return snapshot.metrics.find((metric) => metric.key === key)?.value ?? null;
}

function metricCoverage(snapshot: ReturnType<typeof computeSkillSnapshot>, key: string) {
  return snapshot.metrics.find((metric) => metric.key === key)?.coverage ?? null;
}

function metricRawValue(snapshot: ReturnType<typeof computeSkillSnapshot>, key: string) {
  return snapshot.metrics.find((metric) => metric.key === key)?.rawValue ?? null;
}

{
  const snapshot = computeSkillSnapshot([
    source({ feedback: null }),
    source({ feedback: score({ track: "debate" }), totalScore: null }),
  ]);

  assert.equal(snapshot.overallScore, null);
  assert.equal(snapshot.sourceSessions, 0);
  assert.equal(snapshot.confidence, 0);
}

{
  const snapshot = computeSkillSnapshot([
    source({
      feedback: score({
        track: "speaking",
        clarity: 9,
        delivery: 8,
        logic: 7,
        evidence: 6,
        rebuttal: 1,
      }),
    }),
  ]);

  assert.equal(snapshot.trackBreakdown.speaking, 1);
  assert.equal(snapshot.trackBreakdown.debate, 0);
  assert.notEqual(snapshot.weakestSkill, "rebuttal");
  assert.ok((metricCoverage(snapshot, "rebuttal") ?? 0) < 25);
}

{
  const snapshot = computeSkillSnapshot([
    source({
      feedback: score({
        track: "debate",
        clarity: 8,
        logic: 8,
        evidence: 8,
        rebuttal: 2,
        delivery: 8,
      }),
    }),
  ]);

  assert.equal(snapshot.trackBreakdown.debate, 1);
  assert.equal(snapshot.weakestSkill, "rebuttal");
}

{
  const snapshot = computeSkillSnapshot([
    source({ feedback: score({ track: "speaking", clarity: 9 }) }),
    source({ feedback: score({ track: "debate", logic: 7 }) }),
  ]);

  assert.equal(snapshot.trackBreakdown.speaking, 1);
  assert.equal(snapshot.trackBreakdown.debate, 1);
  assert.ok(snapshot.overallScore != null && snapshot.overallScore > 0);
}

{
  const snapshot = computeSkillSnapshot([
    source({
      feedback: score({ track: "debate", clarity: 2, logic: 2, evidence: 2 }),
      days: 90,
    }),
    source({
      feedback: score({ track: "debate", clarity: 9, logic: 9, evidence: 9 }),
      days: 1,
    }),
  ]);

  assert.ok((metricValue(snapshot, "clarity") ?? 0) > 70);
}

{
  const partialFeedback = score({ track: "debate", logic: 9, evidence: 8 });
  delete (partialFeedback.content as Partial<typeof partialFeedback.content>)
    .counterArgument;

  const snapshot = computeSkillSnapshot([source({ feedback: partialFeedback })]);

  assert.equal(metricCoverage(snapshot, "rebuttal"), 0);
  assert.ok(snapshot.overallScore != null && snapshot.overallScore > 0);
}

{
  const snapshot = computeSkillSnapshot([
    source({
      feedback: score({
        clarity: 8,
        logic: 8,
        evidence: 8,
        rebuttal: 8,
      }),
    }),
  ]);

  assert.equal(snapshot.trackBreakdown.debate, 1);
}

{
  const beginner = computeSkillSnapshot([
    source({
      feedback: score({ track: "speaking", clarity: 8 }),
      topicDifficulty: "beginner",
    }),
  ]);
  const advanced = computeSkillSnapshot([
    source({
      feedback: score({ track: "speaking", clarity: 8 }),
      topicDifficulty: "advanced",
    }),
  ]);

  assert.equal(metricRawValue(beginner, "clarity"), metricRawValue(advanced, "clarity"));
  assert.ok(
    (metricValue(advanced, "clarity") ?? 0) >
      (metricValue(beginner, "clarity") ?? 0)
  );
  assert.equal(advanced.difficultyBreakdown.topic.advanced, 1);
}

{
  const easyAi = computeSkillSnapshot([
    source({
      feedback: score({ track: "debate", rebuttal: 8 }),
      aiDifficulty: "easy",
    }),
  ]);
  const hardAi = computeSkillSnapshot([
    source({
      feedback: score({ track: "debate", rebuttal: 8 }),
      aiDifficulty: "hard",
    }),
  ]);

  assert.ok(
    (metricValue(hardAi, "rebuttal") ?? 0) >
      (metricValue(easyAi, "rebuttal") ?? 0)
  );
  assert.ok(hardAi.confidence > easyAi.confidence);
  assert.equal(hardAi.difficultyBreakdown.ai.hard, 1);
}

{
  const quickEasy = computeSkillSnapshot([
    source({
      feedback: score({ track: "debate", rebuttal: 8 }),
      mode: "quick",
      aiDifficulty: "easy",
    }),
  ]);
  const quickHard = computeSkillSnapshot([
    source({
      feedback: score({ track: "debate", rebuttal: 8 }),
      mode: "quick",
      aiDifficulty: "hard",
    }),
  ]);

  assert.equal(
    metricValue(quickEasy, "rebuttal"),
    metricValue(quickHard, "rebuttal")
  );
  assert.equal(quickHard.difficultyBreakdown.ai.none, 1);
}

console.log("skill-snapshot tests passed");
