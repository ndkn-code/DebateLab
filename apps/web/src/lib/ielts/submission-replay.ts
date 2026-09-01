export type IeltsSubmissionReplayDecision =
  | "new"
  | "resume"
  | "terminal"
  | "conflict";

export class IeltsSubmissionConflictError extends Error {
  constructor() {
    super(
      "This IELTS response already has a different saved submission. Start a new practice attempt to submit a new response.",
    );
    this.name = "IeltsSubmissionConflictError";
  }
}

/**
 * A response row is one immutable learner submission. Network retries may
 * resume its durable run, but a different payload must never replace evidence
 * that is already pending, scored, or teacher-overridden.
 */
export function decideIeltsSubmissionReplay(params: {
  hasExisting: boolean;
  samePayload: boolean;
  terminal: boolean;
}): IeltsSubmissionReplayDecision {
  if (!params.hasExisting) return "new";
  if (!params.samePayload) return "conflict";
  return params.terminal ? "terminal" : "resume";
}
