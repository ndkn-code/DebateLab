export type HomeworkSubmissionState = "draft" | "uploading" | "submitted" | "failed";

export function consumesHomeworkAttempt(state: HomeworkSubmissionState) {
  return state === "submitted";
}

export function canCreateHomeworkRevision(input: {
  state: HomeworkSubmissionState;
  gradeStatus: "submitted" | "graded" | "returned" | "resubmit_requested";
  revisionNumber: 0 | 1;
  hasRevision: boolean;
}) {
  return input.state === "submitted" &&
    input.gradeStatus === "resubmit_requested" &&
    input.revisionNumber === 0 &&
    !input.hasRevision;
}

export function sameHomeworkMime(expected: string | null | undefined, actual: string | null | undefined) {
  return (expected?.trim() || null) === (actual?.trim() || null);
}
