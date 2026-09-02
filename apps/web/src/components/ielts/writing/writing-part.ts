/**
 * Pure helpers for the Writing part layout (Task 1 / Task 2 tabs, word-count
 * badges, GT letter checklist). No React, no DOM — covered by writing-part.test.ts.
 */
import {
  countWords,
  parseWritingCaptureValue,
  recommendedMinWords,
} from "@/lib/ielts/capture/capture-format";

/** IELTS task number for a writing question type (Task 1 → 1, Task 2 → 2). */
export function writingTaskNumber(questionType: string, fallback: number): number {
  if (questionType.startsWith("writing_task1")) return 1;
  if (questionType.startsWith("writing_task2")) return 2;
  return fallback;
}

export interface WritingTaskSummary {
  questionId: string;
  taskNumber: number;
  words: number;
  minWords: number;
  minWordsMet: boolean;
}

/**
 * One summary row per writing question, reading the live essay out of the
 * player's response map (the same shape `WritingTaskRenderer` persists).
 */
export function summarizeWritingTasks(
  questions: ReadonlyArray<{ id: string; questionType: string }>,
  responses: Record<string, unknown>,
): WritingTaskSummary[] {
  return questions.map((question, index) => {
    const essay = parseWritingCaptureValue(responses[question.id]).essay;
    const words = countWords(essay);
    const minWords = recommendedMinWords(question.questionType);
    return {
      questionId: question.id,
      taskNumber: writingTaskNumber(question.questionType, index + 1),
      words,
      minWords,
      minWordsMet: words >= minWords,
    };
  });
}

/** 0–100 fill for the minimum-length meter (clamped; 0 when nothing is written). */
export function writingProgressPercent(words: number, minWords: number): number {
  if (minWords <= 0) return words > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((words / minWords) * 100)));
}

/** Toggle one bullet index in a sorted, de-duplicated checklist selection. */
export function toggleChecklistIndex(
  checked: ReadonlyArray<number>,
  index: number,
): number[] {
  if (checked.includes(index)) return checked.filter((value) => value !== index);
  return [...checked, index].sort((a, b) => a - b);
}

export function isChecklistComplete(
  checked: ReadonlyArray<number>,
  total: number,
): boolean {
  if (total <= 0) return false;
  const unique = new Set(checked.filter((value) => value >= 0 && value < total));
  return unique.size === total;
}
