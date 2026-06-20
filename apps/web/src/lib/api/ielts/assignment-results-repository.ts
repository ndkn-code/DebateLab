/**
 * Per-assignment results for the teacher view (WS-5.3): each enrolled student's
 * completion state + bands. The caller is verified as a club manager, then:
 *   - roster + attempts + bands are read under the manager's RLS
 *     (`can_manage_class` / the WS-5.3 manager SELECT policies), and
 *   - student names are read with the service-role client (profiles RLS is
 *     owner/admin only), scoped to exactly this class's students.
 */
import "server-only";
import { createTypedServerClient } from "@/lib/supabase/server";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { requireClubManager, type IeltsServerClient } from "./assignment-access";
import { getClubIeltsAssignment, type IeltsMockAssignmentRow } from "./assignments-repository";
import {
  deriveLearnerAssignmentProgress,
  summarizeAssignmentCompletion,
  type AssignmentCompletionSummary,
  type AttemptSummary,
  type LearnerAssignmentState,
} from "@/lib/ielts/assignments/status";

export interface StudentAssignmentResult {
  userId: string;
  displayName: string;
  email: string | null;
  state: LearnerAssignmentState;
  overallBand: number | null;
  listeningBand: number | null;
  readingBand: number | null;
  writingBand: number | null;
  speakingBand: number | null;
  resultAttemptId: string | null;
  submittedAt: string | null;
}

export interface AssignmentResults {
  assignment: IeltsMockAssignmentRow;
  summary: AssignmentCompletionSummary;
  students: StudentAssignmentResult[];
}

interface BandSet {
  overall: number | null;
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
}

interface AttemptRow {
  id: string;
  user_id: string;
  status: AttemptSummary["status"];
  started_at: string;
  submitted_at: string | null;
}

async function loadBands(
  supabase: IeltsServerClient,
  attemptIds: string[],
): Promise<Map<string, BandSet>> {
  if (attemptIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("attempt_band_scores")
    .select("attempt_id, overall_band, listening_band, reading_band, writing_band, speaking_band")
    .in("attempt_id", attemptIds);
  if (error) throw new Error(`assignment results bands: ${error.message}`);
  return new Map(
    (data ?? []).map((row) => [
      row.attempt_id,
      {
        overall: row.overall_band,
        listening: row.listening_band,
        reading: row.reading_band,
        writing: row.writing_band,
        speaking: row.speaking_band,
      },
    ]),
  );
}

interface NameRecord {
  displayName: string;
  email: string | null;
}

async function loadNames(userIds: string[]): Promise<Map<string, NameRecord>> {
  if (userIds.length === 0) return new Map();
  const admin = createTypedAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name, email")
    .in("id", userIds);
  if (error) throw new Error(`assignment results names: ${error.message}`);
  return new Map(
    (data ?? []).map((row) => {
      const trimmed = row.display_name?.trim();
      const fallback = row.email ? row.email.split("@")[0] : "Student";
      return [row.id, { displayName: trimmed || fallback, email: row.email }];
    }),
  );
}

function bandFields(
  bands: BandSet | undefined,
): Pick<StudentAssignmentResult, "listeningBand" | "readingBand" | "writingBand" | "speakingBand"> {
  return {
    listeningBand: bands?.listening ?? null,
    readingBand: bands?.reading ?? null,
    writingBand: bands?.writing ?? null,
    speakingBand: bands?.speaking ?? null,
  };
}

function nameFields(
  name: NameRecord | undefined,
): Pick<StudentAssignmentResult, "displayName" | "email"> {
  return {
    displayName: name?.displayName ?? "Student",
    email: name?.email ?? null,
  };
}

function toStudentResult(
  userId: string,
  userAttempts: AttemptRow[],
  bands: Map<string, BandSet>,
  names: Map<string, NameRecord>,
): StudentAssignmentResult {
  const summaries: AttemptSummary[] = userAttempts.map((attempt) => ({
    id: attempt.id,
    status: attempt.status,
    startedAt: attempt.started_at,
    overallBand: bands.get(attempt.id)?.overall ?? null,
  }));
  const progress = deriveLearnerAssignmentProgress(summaries);
  const resultAttempt = userAttempts.find((attempt) => attempt.id === progress.resultAttemptId);
  const resultBands = progress.resultAttemptId ? bands.get(progress.resultAttemptId) : undefined;
  return {
    userId,
    ...nameFields(names.get(userId)),
    state: progress.state,
    overallBand: progress.overallBand,
    ...bandFields(resultBands),
    resultAttemptId: progress.resultAttemptId,
    submittedAt: resultAttempt?.submitted_at ?? null,
  };
}

function buildStudentResults(
  studentIds: string[],
  attempts: AttemptRow[],
  bands: Map<string, BandSet>,
  names: Map<string, NameRecord>,
): StudentAssignmentResult[] {
  const attemptsByUser = new Map<string, AttemptRow[]>();
  for (const attempt of attempts) {
    const list = attemptsByUser.get(attempt.user_id) ?? [];
    list.push(attempt);
    attemptsByUser.set(attempt.user_id, list);
  }

  return studentIds.map((userId) =>
    toStudentResult(userId, attemptsByUser.get(userId) ?? [], bands, names),
  );
}

/** Load per-student completion + bands for one assignment (or null). */
export async function getAssignmentResultsForManager(
  clubId: string,
  assignmentId: string,
): Promise<AssignmentResults | null> {
  const supabase = await createTypedServerClient();
  await requireClubManager(supabase, clubId);

  const assignment = await getClubIeltsAssignment(clubId, assignmentId, supabase);
  if (!assignment) return null;

  const { data: roster, error: rosterError } = await supabase
    .from("class_memberships")
    .select("user_id")
    .eq("class_id", assignment.classId)
    .eq("member_role", "student")
    .eq("status", "active");
  if (rosterError) throw new Error(`assignment results roster: ${rosterError.message}`);
  const studentIds = (roster ?? []).map((row) => row.user_id);

  const { data: attempts, error: attemptsError } = await supabase
    .from("ielts_attempts")
    .select("id, user_id, status, started_at, submitted_at")
    .eq("assignment_id", assignmentId);
  if (attemptsError) throw new Error(`assignment results attempts: ${attemptsError.message}`);
  const attemptRows = (attempts ?? []) as AttemptRow[];

  const bands = await loadBands(supabase, attemptRows.map((attempt) => attempt.id));
  const names = await loadNames(studentIds);

  const students = buildStudentResults(studentIds, attemptRows, bands, names);
  const summary = summarizeAssignmentCompletion(
    students.map((student) => ({
      userId: student.userId,
      state: student.state,
      overallBand: student.overallBand,
    })),
  );

  return { assignment, summary, students };
}
