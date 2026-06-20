/**
 * Pure derivation of IELTS class-assignment progress (WS-5.3). No IO — it turns
 * raw `ielts_attempts` rows into the learner-facing CTA state and the teacher
 * per-assignment completion summary. Shared by the learner "assigned tests"
 * view and the teacher results view; unit-tested in `status.test.ts`.
 */

/** Mirrors the `ielts_attempt_status` enum. */
export type IeltsAttemptStatus =
  | "in_progress"
  | "submitted"
  | "scoring"
  | "completed"
  | "expired"
  | "abandoned";

/** Learner-facing state for one assignment (collapses any number of attempts). */
export type LearnerAssignmentState =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "completed";

export interface AttemptSummary {
  id: string;
  status: IeltsAttemptStatus;
  /** ISO timestamp; used only to pick the most recent attempt. */
  startedAt: string;
  overallBand: number | null;
}

export interface LearnerAssignmentProgress {
  state: LearnerAssignmentState;
  /** The attempt a results view should link to (latest terminal attempt). */
  resultAttemptId: string | null;
  /** Overall band of that results attempt, when it has been computed. */
  overallBand: number | null;
}

/** Statuses that represent a finished sitting (submitted onward). */
const TERMINAL: ReadonlySet<IeltsAttemptStatus> = new Set([
  "completed",
  "scoring",
  "submitted",
]);

/** Newest-first by startedAt — ISO-8601 strings sort lexically by time. */
function newestFirst(attempts: AttemptSummary[]): AttemptSummary[] {
  return [...attempts].sort((a, b) => {
    if (a.startedAt < b.startedAt) return 1;
    if (a.startedAt > b.startedAt) return -1;
    return 0;
  });
}

/**
 * Collapse a learner's attempts at one assignment into a single state + the
 * attempt whose results should be surfaced. Precedence: a finished sitting wins
 * over an in-progress one; expired/abandoned-only reads as "not started" so the
 * learner can re-sit.
 */
export function deriveLearnerAssignmentProgress(
  attempts: AttemptSummary[],
): LearnerAssignmentProgress {
  const ordered = newestFirst(attempts);
  const terminal = ordered.find((attempt) => TERMINAL.has(attempt.status)) ?? null;

  let state: LearnerAssignmentState = "not_started";
  if (terminal?.status === "completed") {
    state = "completed";
  } else if (terminal) {
    state = "submitted";
  } else if (ordered.some((attempt) => attempt.status === "in_progress")) {
    state = "in_progress";
  }

  return {
    state,
    resultAttemptId: terminal?.id ?? null,
    overallBand: terminal?.overallBand ?? null,
  };
}

/** A single student's progress, as fed to the completion summary. */
export interface MemberAssignmentProgress {
  userId: string;
  state: LearnerAssignmentState;
  overallBand: number | null;
}

export interface AssignmentCompletionSummary {
  total: number;
  notStarted: number;
  inProgress: number;
  submitted: number;
  completed: number;
  /** Mean overall band across members with a band (1 decimal); null if none. */
  averageBand: number | null;
}

/** Aggregate a roster's per-student progress into headline completion stats. */
export function summarizeAssignmentCompletion(
  members: MemberAssignmentProgress[],
): AssignmentCompletionSummary {
  const summary: AssignmentCompletionSummary = {
    total: members.length,
    notStarted: 0,
    inProgress: 0,
    submitted: 0,
    completed: 0,
    averageBand: null,
  };

  const bands: number[] = [];
  for (const member of members) {
    if (member.state === "completed") summary.completed += 1;
    else if (member.state === "submitted") summary.submitted += 1;
    else if (member.state === "in_progress") summary.inProgress += 1;
    else summary.notStarted += 1;
    if (member.overallBand !== null) bands.push(member.overallBand);
  }

  if (bands.length > 0) {
    const mean = bands.reduce((sum, band) => sum + band, 0) / bands.length;
    summary.averageBand = Math.round(mean * 10) / 10;
  }

  return summary;
}
