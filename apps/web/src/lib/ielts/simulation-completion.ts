import { writingOverallBand } from "@/lib/scoring/ielts-writing/band-math";

/**
 * Pure completion contract for a full IELTS simulation.
 *
 * Listening and Reading objective bands plus the required Writing band gate
 * attempt completion. Speaking is intentionally optional for completion while
 * it may still contribute to a provisional/official overall later.
 */
export interface SimulationCompletionInput {
  listeningBand: number | null;
  readingBand: number | null;
  writingBand: number | null;
  writingRequired: boolean;
  speakingBand: number | null;
  overallBand: number | null;
}

export interface SimulationCompletionDecision {
  attemptComplete: boolean;
  overallComplete: boolean;
  missingRequiredSkills: Array<"listening" | "reading" | "writing">;
}

export interface RequiredWritingResponse {
  id: string;
  questionId: string;
  taskNumber: number;
  revision: number;
  status: string;
  taskBand: number | null;
}

export interface PublishedWritingReview {
  writingResponseId: string;
  revision: number;
  taskBand: number | null;
}

export interface RequiredWritingCompletion {
  ready: boolean;
  writingBand: number | null;
}

/**
 * A simulation Writing section is ready only when every frozen task has a
 * score for its current response revision. A published teacher score is
 * authoritative and can complete a task whose AI score failed; drafts and
 * stale review revisions are deliberately excluded by the repository.
 */
export function resolveRequiredWritingCompletion(params: {
  requiredQuestionIds: string[];
  responses: RequiredWritingResponse[];
  publishedReviews: PublishedWritingReview[];
}): RequiredWritingCompletion {
  const requiredQuestionIds = [...new Set(params.requiredQuestionIds)];
  if (requiredQuestionIds.length === 0) {
    return { ready: true, writingBand: null };
  }

  const latestResponseByQuestion = new Map<string, RequiredWritingResponse>();
  for (const response of params.responses) {
    const current = latestResponseByQuestion.get(response.questionId);
    if (!current || response.revision > current.revision) {
      latestResponseByQuestion.set(response.questionId, response);
    }
  }

  const taskBands: Array<{ taskNumber: number; band: number }> = [];
  for (const questionId of requiredQuestionIds) {
    const response = latestResponseByQuestion.get(questionId);
    if (!response) return { ready: false, writingBand: null };
    const publishedBand = params.publishedReviews.find(
      (review) =>
        review.writingResponseId === response.id &&
        review.revision === response.revision &&
        review.taskBand != null,
    )?.taskBand;
    const band =
      publishedBand ??
      ((response.status === "scored" || response.status === "overridden")
        ? response.taskBand
        : null);
    if (band == null) return { ready: false, writingBand: null };
    taskBands.push({ taskNumber: response.taskNumber, band });
  }

  const task1Band =
    taskBands.find((task) => task.taskNumber === 1)?.band ?? null;
  const task2Band =
    taskBands.find((task) => task.taskNumber === 2)?.band ?? null;
  if (
    requiredQuestionIds.length > 1 &&
    (task1Band == null || task2Band == null)
  ) {
    return { ready: false, writingBand: null };
  }
  const writingBand = writingOverallBand({ task1Band, task2Band });
  return { ready: writingBand != null, writingBand };
}

export function areRequiredWritingTasksReady(params: {
  requiredQuestionIds: string[];
  responses: RequiredWritingResponse[];
  publishedReviews: PublishedWritingReview[];
}): boolean {
  return resolveRequiredWritingCompletion(params).ready;
}

export function evaluateSimulationCompletion(
  input: SimulationCompletionInput,
): SimulationCompletionDecision {
  const missingRequiredSkills: SimulationCompletionDecision["missingRequiredSkills"] = [];
  if (input.listeningBand == null) missingRequiredSkills.push("listening");
  if (input.readingBand == null) missingRequiredSkills.push("reading");
  if (input.writingRequired && input.writingBand == null) {
    missingRequiredSkills.push("writing");
  }

  // An overall is official only when all four skill bands exist. A partial
  // numeric overall is deliberately never treated as complete.
  const overallComplete =
    input.listeningBand != null &&
    input.readingBand != null &&
    input.writingBand != null &&
    input.speakingBand != null &&
    input.overallBand != null;

  return {
    attemptComplete: missingRequiredSkills.length === 0,
    overallComplete,
    missingRequiredSkills,
  };
}
