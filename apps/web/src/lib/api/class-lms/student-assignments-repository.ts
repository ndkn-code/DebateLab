import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionUserId } from "@/lib/api/ielts/assignment-access";
import { createTypedServerClient } from "@/lib/supabase/server";
import {
  buildStudentAssignmentSummaries,
  type StudentAssignmentRow,
  type StudentAssignmentSubmissionRow,
  type StudentAssignmentSummary,
} from "./student-assignments-model";

/**
 * Occurrence-independent delivery for the learner.
 *
 * `student-weekly-repository.ts` can only surface an assignment that a teacher
 * linked to a published lesson occurrence *inside the requested week*. That link
 * table has no application writer, and even once it does, a week-scoped view
 * hides work due next week. This read is the durable path: every active
 * assignment belonging to a class the learner is an active student of.
 *
 * No service-role client and no migration: RLS on `club_assignments` already
 * admits an active class member for `status = 'active'` rows
 * (policy "Organization exact assignment reads"), and
 * `club_assignment_submissions` is scoped to `user_id = auth.uid()`.
 */
export async function loadMyAssignedWork(): Promise<StudentAssignmentSummary[]> {
  const session = await createTypedServerClient();
  const userId = await getSessionUserId(session);
  const db = session as unknown as SupabaseClient;

  const { data: memberships, error: membershipError } = await db
    .from("class_memberships")
    .select("class_id")
    .eq("user_id", userId)
    .eq("member_role", "student")
    .eq("status", "active");
  if (membershipError) {
    throw new Error(`loadMyAssignedWork(memberships): ${membershipError.message}`);
  }

  const classIds = [
    ...new Set(
      (memberships ?? [])
        .map((row) => row.class_id)
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
  if (classIds.length === 0) return [];

  const [classesResult, assignmentsResult] = await Promise.all([
    db.from("classes").select("id, title").in("id", classIds),
    db
      .from("club_assignments")
      .select(
        "id, club_id, class_id, title, assignment_type, due_at, required_attempts, status",
      )
      .in("class_id", classIds)
      .eq("status", "active"),
  ]);
  const listFailure = [classesResult, assignmentsResult].find(
    (result) => result.error,
  );
  if (listFailure?.error) {
    throw new Error(`loadMyAssignedWork: ${listFailure.error.message}`);
  }

  const assignments = (assignmentsResult.data ?? []) as StudentAssignmentRow[];
  if (assignments.length === 0) return [];

  const { data: submissionRows, error: submissionError } = await db
    .from("club_assignment_submissions")
    .select(
      "assignment_id, submission_state, grade_status, score, score_max, feedback, graded_at, created_at",
    )
    .eq("user_id", userId)
    .in(
      "assignment_id",
      assignments.map((assignment) => assignment.id),
    )
    .order("created_at", { ascending: false });
  if (submissionError) {
    throw new Error(`loadMyAssignedWork(submissions): ${submissionError.message}`);
  }

  const classTitles = new Map(
    ((classesResult.data ?? []) as Array<{ id: string; title: string }>).map(
      (row) => [row.id, row.title],
    ),
  );

  return buildStudentAssignmentSummaries({
    assignments,
    classTitles,
    submissions: (submissionRows ?? []) as StudentAssignmentSubmissionRow[],
  });
}

export type { StudentAssignmentSummary };
