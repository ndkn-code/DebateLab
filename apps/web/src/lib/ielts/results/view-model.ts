/**
 * Top-level pure assembler for the IELTS results view-model (WS-2.2). Composes
 * the band summary, raw→band breakdown, objective review, and Writing/Speaking
 * projections from the de-DB'd {@link AttemptResultsInput} the results
 * repository supplies. The server page calls this and hands the result to the
 * (client) results components — everything returned is serialisable and
 * key-free.
 */
import {
  buildBandBreakdowns,
  buildOverallSummary,
  buildSkillBandRows,
  type DerivedSkillBands,
} from "./band-summary";
import { buildObjectiveReview } from "./objective-review";
import {
  buildSpeakingResult,
  buildWritingResult,
  feedbackSkillStatus,
} from "./skill-feedback";
import type { AttemptResultsInput, AttemptResultsViewModel } from "./types";

export function buildAttemptResultsViewModel(
  input: AttemptResultsInput,
): AttemptResultsViewModel {
  const writing = buildWritingResult(input.writingTasks);
  const speaking = buildSpeakingResult(input.speakingParts);

  const derived: DerivedSkillBands = {
    writingBand: writing?.band ?? input.storedWritingBand ?? null,
    speakingBand: speaking?.band ?? input.storedSpeakingBand ?? null,
    writingStatus: feedbackSkillStatus(writing),
    speakingStatus: feedbackSkillStatus(speaking),
  };

  return {
    attemptId: input.attemptId,
    testTitle: input.testTitle,
    testSlug: input.testSlug,
    module: input.module,
    attemptStatus: input.attemptStatus,
    submittedAt: input.submittedAt,
    overall: buildOverallSummary(input, derived),
    skills: buildSkillBandRows(input, derived),
    breakdowns: buildBandBreakdowns(input),
    objective: buildObjectiveReview(input),
    writing,
    speaking,
  };
}
