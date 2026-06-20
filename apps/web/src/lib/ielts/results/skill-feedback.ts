/**
 * Pure Writing/Speaking result projections for the IELTS results screen
 * (WS-2.2). The async AI scorers (WS-3.1 Writing, WS-3.2 Speaking) persist typed
 * per-criterion bands plus a jsonb transparency envelope; this defensively
 * parses that envelope (it may still be the `{}` default mid-scoring) and shapes
 * it for display, derives the per-skill band from the official math, and reports
 * an "in progress / not attempted / scored" state so the UI degrades gracefully
 * while a skill is still being marked.
 */
import { z } from "zod";
import { roundToHalfBand } from "@/lib/scoring/round-half-band";
import { writingOverallBand } from "@/lib/scoring/ielts-writing/band-math";
import { isTerminalWritingStatus } from "@/lib/ielts/writing-scorer/status";
import type {
  CriterionScore,
  ResultsInlineCorrection,
  ResultsParagraphFeedback,
  ResultsSpeakingPart,
  ResultsWritingTask,
  SkillResultStatus,
  SpeakingPartResult,
  SpeakingResult,
  WritingResult,
  WritingTaskResult,
} from "./types";

const WRITING_CRITERIA: Array<{ key: string; label: string; band: keyof ResultsWritingTask }> = [
  { key: "taskResponse", label: "Task Response / Achievement", band: "taskResponseBand" },
  { key: "coherenceCohesion", label: "Coherence & Cohesion", band: "coherenceCohesionBand" },
  { key: "lexicalResource", label: "Lexical Resource", band: "lexicalResourceBand" },
  { key: "grammaticalRangeAccuracy", label: "Grammatical Range & Accuracy", band: "grammarBand" },
];

const SPEAKING_CRITERIA: Array<{ key: string; label: string; band: keyof ResultsSpeakingPart }> = [
  { key: "fluencyCoherence", label: "Fluency & Coherence", band: "fluencyCoherenceBand" },
  { key: "lexicalResource", label: "Lexical Resource", band: "lexicalResourceBand" },
  { key: "grammaticalRangeAccuracy", label: "Grammatical Range & Accuracy", band: "grammarBand" },
  { key: "pronunciation", label: "Pronunciation", band: "pronunciationBand" },
];

const CriteriaFeedbackSchema = z
  .object({
    summary: z.string().optional(),
    vietnameseSummary: z.string().nullish(),
    criteria: z
      .record(
        z.string(),
        z.object({ rationale: z.string().optional() }).catch({}),
      )
      .optional(),
  })
  .catch({});

const InlineCorrectionsSchema = z
  .array(
    z.object({
      original: z.string().catch(""),
      suggestion: z.string().catch(""),
      errorType: z.string().catch("other"),
      explanation: z.string().catch(""),
      paragraph: z.number().nullish(),
    }),
  )
  .catch([]);

const ParagraphFeedbackSchema = z
  .array(
    z.object({
      paragraph: z.number().catch(0),
      comment: z.string().catch(""),
      strengths: z.array(z.string()).catch([]),
      improvements: z.array(z.string()).catch([]),
    }),
  )
  .catch([]);

const SpeakingFeedbackSchema = z
  .object({
    summary: z.string().optional(),
    criteria: z
      .record(z.string(), z.object({ rationale: z.string().optional() }).catch({}))
      .optional(),
  })
  .catch({});

function criterionRationale(
  criteria: Record<string, { rationale?: string }> | undefined,
  key: string,
): string | null {
  return criteria?.[key]?.rationale?.trim() || null;
}

function toInlineCorrections(raw: unknown): ResultsInlineCorrection[] {
  return InlineCorrectionsSchema.parse(raw ?? []).map((item) => ({
    original: item.original,
    suggestion: item.suggestion,
    errorType: item.errorType,
    explanation: item.explanation,
    paragraph: item.paragraph ?? null,
  }));
}

function toParagraphFeedback(raw: unknown): ResultsParagraphFeedback[] {
  return ParagraphFeedbackSchema.parse(raw ?? []);
}

function toWritingTaskResult(task: ResultsWritingTask): WritingTaskResult {
  const feedback = CriteriaFeedbackSchema.parse(task.criteriaFeedback ?? {});
  const criteria: CriterionScore[] = WRITING_CRITERIA.map((entry) => ({
    key: entry.key,
    label: entry.label,
    band: (task[entry.band] as number | null) ?? null,
    rationale: criterionRationale(feedback.criteria, entry.key),
  }));
  return {
    questionId: task.questionId,
    taskNumber: task.taskNumber,
    status: task.status,
    wordCount: task.wordCount,
    taskBand: task.taskBand,
    criteria,
    summary: feedback.summary?.trim() || null,
    vietnameseSummary: feedback.vietnameseSummary?.trim() || null,
    inlineCorrections: toInlineCorrections(task.inlineCorrections),
    paragraphFeedback: toParagraphFeedback(task.paragraphFeedback),
    modelAnswer: task.modelAnswer,
    feedbackLanguage: task.feedbackLanguage,
  };
}

/** Project all Writing tasks for an attempt into the results view-model. */
export function buildWritingResult(
  tasks: ResultsWritingTask[],
): WritingResult | null {
  if (tasks.length === 0) return null;
  const results = tasks
    .map(toWritingTaskResult)
    .sort((a, b) => a.taskNumber - b.taskNumber);
  const task1Band = results.find((task) => task.taskNumber === 1)?.taskBand ?? null;
  const task2Band = results.find((task) => task.taskNumber === 2)?.taskBand ?? null;
  return {
    band: writingOverallBand({ task1Band, task2Band }),
    isComplete: results.every((task) => isTerminalWritingStatus(task.status)),
    anyPending: results.some((task) => !isTerminalWritingStatus(task.status)),
    tasks: results,
  };
}

function toSpeakingPartResult(part: ResultsSpeakingPart): SpeakingPartResult {
  const feedback = SpeakingFeedbackSchema.parse(part.feedback ?? {});
  const criteria: CriterionScore[] = SPEAKING_CRITERIA.map((entry) => ({
    key: entry.key,
    label: entry.label,
    band: (part[entry.band] as number | null) ?? null,
    rationale: criterionRationale(feedback.criteria, entry.key),
  }));
  return {
    questionId: part.questionId,
    partNumber: part.partNumber,
    status: part.status,
    transcript: part.transcript,
    band: part.speakingBand,
    criteria,
    summary: feedback.summary?.trim() || null,
  };
}

/** Project all Speaking parts for an attempt into the results view-model. */
export function buildSpeakingResult(
  parts: ResultsSpeakingPart[],
): SpeakingResult | null {
  if (parts.length === 0) return null;
  const results = parts
    .map(toSpeakingPartResult)
    .sort((a, b) => (a.partNumber ?? 0) - (b.partNumber ?? 0));
  const scoredBands = results
    .map((part) => part.band)
    .filter((band): band is number => band !== null);
  const band =
    scoredBands.length === 0
      ? null
      : roundToHalfBand(
          scoredBands.reduce((sum, value) => sum + value, 0) / scoredBands.length,
        );
  return {
    band,
    isComplete: results.every((part) => isTerminalWritingStatus(part.status)),
    anyPending: results.some((part) => !isTerminalWritingStatus(part.status)),
    parts: results,
  };
}

/** Per-skill status for a Writing/Speaking result (null = no submission). */
export function feedbackSkillStatus(
  result: { isComplete: boolean; anyPending: boolean } | null,
): SkillResultStatus {
  if (!result) return "not_attempted";
  if (result.isComplete) return "scored";
  return result.anyPending ? "in_progress" : "scored";
}
