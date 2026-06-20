import type { LearnerAssignmentState } from "@/lib/ielts/assignments/status";

/** Semantic-token pill classes for a learner's per-assignment state. */
export const ASSIGNMENT_STATE_PILL: Record<LearnerAssignmentState, string> = {
  not_started: "bg-surface-container-high text-on-surface-variant",
  in_progress: "bg-warning-container text-on-warning-container",
  submitted: "bg-primary-container text-primary-dim",
  completed: "bg-success-container text-success-dim",
};
