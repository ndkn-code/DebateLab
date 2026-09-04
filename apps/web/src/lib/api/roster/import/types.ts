/**
 * Roster import contract (B3). Shared by the pure planner, the server-only
 * executor, the server actions and the dialog.
 *
 * The outcome vocabulary deliberately extends `ClubInviteResultStatus`
 * (`lib/types/admin-clubs.ts:16`) rather than inventing a parallel one, so a
 * roster import and a club invite report read the same way.
 */
import type { RosterFieldId } from "../columns";

/** One normalized student, before it touches the database. */
export interface RosterRecordInput {
  fullName: string;
  email: string | null;
  studentCode: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  notes: string | null;
}

export type RosterIssueCode =
  | "missing_full_name"
  | "invalid_email"
  | "invalid_guardian_email"
  | "invalid_date"
  | "invalid_student_code"
  | "duplicate_in_file"
  | "duplicate_student_code"
  | "ambiguous_name_match"
  | "class_at_capacity"
  | "write_failed";

export interface RosterRowIssue {
  /** `null` when the problem is about the row as a whole, not one cell. */
  field: RosterFieldId | null;
  code: RosterIssueCode;
  /**
   * The offending value or extra context, interpolated into the localized
   * message by `describeIssue`. Never a pre-rendered sentence — a Vietnamese
   * teacher must not receive an English error sheet.
   */
  detail?: string;
}

export interface PlannedRosterRow {
  /** 1-based data row (header is row 0), so it matches what the teacher sees. */
  rowNumber: number;
  values: RosterRecordInput;
  /** The original cells, kept verbatim for the error sheet. */
  raw: Partial<Record<RosterFieldId, string>>;
  issues: RosterRowIssue[];
  /** A blocked row is never written — it is reported and re-imported after a fix. */
  blocked: boolean;
}

export interface RosterImportPlan {
  rows: PlannedRosterRow[];
  /** Sheet-level problems: blank headers, duplicated headers, nothing to import. */
  warnings: string[];
  counts: {
    total: number;
    ready: number;
    blocked: number;
    /** Rows carrying an email — i.e. rows that will trigger an account invite. */
    withEmail: number;
  };
}

/**
 * Per-row outcome. `created`/`updated`/`skipped` describe the roster record;
 * `invited`/`email_skipped` additionally describe the account rail.
 */
export type RosterRowOutcome =
  | "created"
  | "updated"
  | "skipped"
  | "invited"
  | "email_skipped"
  | "needs_review"
  | "error";

export interface RosterRowResult {
  rowNumber: number;
  fullName: string;
  email: string | null;
  outcome: RosterRowOutcome;
  studentRecordId: string | null;
  /** Set when an invitation row was written for this student. */
  invitationId?: string | null;
  issues: RosterRowIssue[];
}

/**
 * What a dry run predicts, and what a commit reports — the same shape, so the
 * preview screen and the result screen render from one component.
 */
export interface RosterImportReport {
  /** `null` for a dry run; the persisted batch id after a commit. */
  batchId: string | null;
  dryRun: boolean;
  counts: Record<RosterRowOutcome, number>;
  rows: RosterRowResult[];
  warnings: string[];
  /**
   * `class_at_capacity` is checked before any write: `private.enforce_class_capacity`
   * raises mid-statement and would abort a partially applied batch.
   */
  capacity: { max: number | null; current: number; incoming: number } | null;
}

export const EMPTY_OUTCOME_COUNTS: Record<RosterRowOutcome, number> = {
  created: 0,
  updated: 0,
  skipped: 0,
  invited: 0,
  email_skipped: 0,
  needs_review: 0,
  error: 0,
};

export function countOutcomes(
  rows: readonly RosterRowResult[],
): Record<RosterRowOutcome, number> {
  const counts = { ...EMPTY_OUTCOME_COUNTS };
  for (const row of rows) counts[row.outcome] += 1;
  return counts;
}
