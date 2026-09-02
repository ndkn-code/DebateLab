import type {
  IeltsQuestionView,
  IeltsResponseMap,
} from "@/lib/ielts/question-contract";
import { assignQuestionNumbers } from "@/lib/ielts/question-groups";
import { isAnsweredResponse } from "@/lib/scoring/ielts/answer-normalize";
import { mockAnnotationKey } from "@/lib/stores/mockAnnotationsStore";
import type { MockPart } from "./mock-parts";

export interface MockQuestionStatus {
  question: IeltsQuestionView;
  questionId: string;
  /** First official question number this row occupies (1-based). */
  number: number;
  /** Official label as printed on the paper: "7", or "21–22" for a span. */
  numberLabel: string;
  /** How many official question numbers this row occupies (2 for "21–22"). */
  span: number;
  partIndex: number;
  partTitle: string;
  answered: boolean;
  flagged: boolean;
  current: boolean;
}

export interface MockQuestionCounts {
  total: number;
  answered: number;
  unanswered: number;
  flagged: number;
}

export function buildMockQuestionStatuses({
  parts,
  responses,
  flags,
  attemptId,
  activeQuestionId,
}: {
  parts: MockPart[];
  responses: IeltsResponseMap;
  flags: Record<string, true>;
  attemptId: string;
  activeQuestionId: string | null;
}): MockQuestionStatus[] {
  // Official-paper numbering: sequential across parts, a `numberSpan` row
  // consumes several numbers ("21–22") and the next row continues after it.
  const numbers = assignQuestionNumbers(parts);
  let fallback = 0;
  return parts.flatMap((part, partIndex) =>
    part.questions.map((question) => {
      fallback += 1;
      const assigned = numbers.get(question.id);
      return {
        question,
        questionId: question.id,
        number: assigned?.start ?? fallback,
        numberLabel: assigned?.label ?? String(fallback),
        span: assigned ? assigned.end - assigned.start + 1 : 1,
        partIndex,
        partTitle: part.title,
        answered: isAnsweredResponse(responses[question.id]),
        flagged: flags[mockAnnotationKey(attemptId, question.id)] === true,
        current: activeQuestionId === question.id,
      };
    }),
  );
}

export function summarizeMockQuestionStatuses(
  statuses: readonly MockQuestionStatus[],
): MockQuestionCounts {
  // Counts are in official question numbers ("x of 40"), so a "21–22" row
  // contributes two to both the total and, once answered, the answered count.
  const total = statuses.reduce((sum, status) => sum + status.span, 0);
  const answered = statuses
    .filter((status) => status.answered)
    .reduce((sum, status) => sum + status.span, 0);
  const flagged = statuses.filter((status) => status.flagged).length;
  return {
    total,
    answered,
    unanswered: Math.max(0, total - answered),
    flagged,
  };
}
