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
