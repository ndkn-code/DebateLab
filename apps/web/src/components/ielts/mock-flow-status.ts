import type {
  IeltsQuestionView,
  IeltsResponseMap,
} from "@/lib/ielts/question-contract";
import { isAnsweredResponse } from "@/lib/scoring/ielts/answer-normalize";
import { mockAnnotationKey } from "@/lib/stores/mockAnnotationsStore";
import type { MockPart } from "./mock-parts";

export interface MockQuestionStatus {
  question: IeltsQuestionView;
  questionId: string;
  number: number;
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
  let number = 0;
  return parts.flatMap((part, partIndex) =>
    part.questions.map((question) => {
      number += 1;
      return {
        question,
        questionId: question.id,
        number,
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
  const answered = statuses.filter((status) => status.answered).length;
  const flagged = statuses.filter((status) => status.flagged).length;
  return {
    total: statuses.length,
    answered,
    unanswered: Math.max(0, statuses.length - answered),
    flagged,
  };
}
