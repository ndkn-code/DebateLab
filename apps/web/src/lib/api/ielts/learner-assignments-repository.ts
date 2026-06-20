/**
 * Learner-facing IELTS class-assignment reads (WS-5.3): the "assigned tests"
 * list and the authorization resolve used when a learner starts a sitting.
 * Everything runs under the learner's RLS — the WS-5.3 class-member SELECT
 * policy surfaces IELTS-mock assignments for classes they are enrolled in, and
 * the owner policies surface their own attempts/bands. Class titles + test
 * metadata are batch-read (not embedded) to avoid relationship ambiguity.
 */
import "server-only";
import { createTypedServerClient } from "@/lib/supabase/server";
import { getSessionUserId, type IeltsServerClient } from "./assignment-access";
import {
  deriveLearnerAssignmentProgress,
  type AttemptSummary,
  type LearnerAssignmentProgress,
} from "@/lib/ielts/assignments/status";

export interface LearnerAssignedTest {
  assignmentId: string;
  title: string;
  testTitle: string | null;
  testSlug: string | null;
  testModule: string | null;
  className: string | null;
  dueAt: string | null;
  progress: LearnerAssignmentProgress;
}

interface RawLearnerAssignment {
  id: string;
  title: string;
  due_at: string | null;
  class_id: string | null;
  ielts_test_id: string | null;
}

interface TestMeta {
  title: string | null;
  slug: string | null;
  module: string | null;
}

function unique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function loadClassTitles(
  supabase: IeltsServerClient,
  classIds: string[],
): Promise<Map<string, string | null>> {
  if (classIds.length === 0) return new Map();
  const { data, error } = await supabase.from("classes").select("id, title").in("id", classIds);
  if (error) throw new Error(`listLearnerAssignedTests classes: ${error.message}`);
  return new Map((data ?? []).map((row) => [row.id, row.title]));
}

async function loadTestMeta(
  supabase: IeltsServerClient,
  testIds: string[],
): Promise<Map<string, TestMeta>> {
  if (testIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("ielts_tests")
    .select("id, title, slug, module")
    .in("id", testIds);
  if (error) throw new Error(`listLearnerAssignedTests tests: ${error.message}`);
  return new Map(
    (data ?? []).map((row) => [row.id, { title: row.title, slug: row.slug, module: row.module }]),
  );
}

async function loadOwnOverallBands(
  supabase: IeltsServerClient,
  attemptIds: string[],
): Promise<Map<string, number | null>> {
  if (attemptIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("attempt_band_scores")
    .select("attempt_id, overall_band")
    .in("attempt_id", attemptIds);
  if (error) throw new Error(`listLearnerAssignedTests bands: ${error.message}`);
  return new Map((data ?? []).map((row) => [row.attempt_id, row.overall_band]));
}

/** The active IELTS mocks assigned to the learner's classes, with progress. */
export async function listLearnerAssignedTests(): Promise<LearnerAssignedTest[]> {
  const supabase = await createTypedServerClient();
  const userId = await getSessionUserId(supabase);

  const { data: rows, error } = await supabase
    .from("club_assignments")
    .select("id, title, due_at, class_id, ielts_test_id")
    .eq("assignment_type", "ielts_mock")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listLearnerAssignedTests: ${error.message}`);
  const assignments = (rows ?? []) as RawLearnerAssignment[];
  if (assignments.length === 0) return [];

  const assignmentIds = assignments.map((row) => row.id);
  const { data: attempts, error: attemptsError } = await supabase
    .from("ielts_attempts")
    .select("id, assignment_id, status, started_at")
    .eq("user_id", userId)
    .in("assignment_id", assignmentIds);
  if (attemptsError) throw new Error(`listLearnerAssignedTests attempts: ${attemptsError.message}`);

  const [classTitles, testMeta, bands] = await Promise.all([
    loadClassTitles(supabase, unique(assignments.map((row) => row.class_id))),
    loadTestMeta(supabase, unique(assignments.map((row) => row.ielts_test_id))),
    loadOwnOverallBands(supabase, (attempts ?? []).map((attempt) => attempt.id)),
  ]);

  const summariesByAssignment = new Map<string, AttemptSummary[]>();
  for (const attempt of attempts ?? []) {
    if (!attempt.assignment_id) continue;
    const list = summariesByAssignment.get(attempt.assignment_id) ?? [];
    list.push({
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.started_at,
      overallBand: bands.get(attempt.id) ?? null,
    });
    summariesByAssignment.set(attempt.assignment_id, list);
  }

  return assignments.map((row) => {
    const test = row.ielts_test_id ? testMeta.get(row.ielts_test_id) : undefined;
    return {
      assignmentId: row.id,
      title: row.title,
      testTitle: test?.title ?? null,
      testSlug: test?.slug ?? null,
      testModule: test?.module ?? null,
      className: row.class_id ? classTitles.get(row.class_id) ?? null : null,
      dueAt: row.due_at,
      progress: deriveLearnerAssignmentProgress(summariesByAssignment.get(row.id) ?? []),
    };
  });
}

export interface ResolvedAssignmentStart {
  userId: string;
  testId: string;
  classId: string;
  clubId: string;
}

/**
 * Resolve an assignment for a learner about to start it: confirms it is an
 * active IELTS mock and the learner is actually enrolled in its class. Throws a
 * readable error otherwise. The returned ids stamp the created attempt.
 */
export async function resolveAssignmentForStart(
  assignmentId: string,
): Promise<ResolvedAssignmentStart> {
  const supabase = await createTypedServerClient();
  const userId = await getSessionUserId(supabase);

  const { data: assignment, error } = await supabase
    .from("club_assignments")
    .select("id, club_id, class_id, ielts_test_id, status")
    .eq("id", assignmentId)
    .eq("assignment_type", "ielts_mock")
    .maybeSingle();
  if (error) throw new Error(`resolveAssignmentForStart: ${error.message}`);
  if (!assignment || !assignment.ielts_test_id || !assignment.class_id || !assignment.club_id) {
    throw new Error("Assignment not available");
  }
  if (assignment.status !== "active") throw new Error("This assignment is no longer active");

  const { data: membership, error: membershipError } = await supabase
    .from("class_memberships")
    .select("id")
    .eq("class_id", assignment.class_id)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) throw new Error(`resolveAssignmentForStart: ${membershipError.message}`);
  if (!membership) throw new Error("You are not enrolled in this class");

  return {
    userId,
    testId: assignment.ielts_test_id,
    classId: assignment.class_id,
    clubId: assignment.club_id,
  };
}

/** Non-throwing guard: is this assignment startable by the learner for this test? */
export async function isAssignmentStartableForTest(
  assignmentId: string,
  testId: string,
): Promise<boolean> {
  try {
    const resolved = await resolveAssignmentForStart(assignmentId);
    return resolved.testId === testId;
  } catch {
    return false;
  }
}
