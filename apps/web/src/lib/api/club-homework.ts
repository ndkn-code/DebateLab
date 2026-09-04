import "server-only";

import { createTypedServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionUserId, type IeltsServerClient } from "@/lib/api/ielts/assignment-access";
import { requireClassManager, requireClubOwner } from "@/lib/api/class-manager-access";
import type { HomeworkSubmissionState } from "@/lib/api/club-homework-model";

const HOMEWORK_BUCKET = "assignment-submissions";

export type HomeworkGradeStatus = "submitted" | "graded" | "returned" | "resubmit_requested";

export interface HomeworkAssignmentDetail {
  id: string;
  clubId: string;
  classId: string | null;
  classTitle: string | null;
  title: string;
  description: string | null;
  dueAt: string | null;
  requiredAttempts: number;
  status: string;
  submissionTextEnabled: boolean;
  submissionFilesEnabled: boolean;
  submissionMaxFiles: number;
  submissionMaxFileMb: number;
  submissionAllowedExt: string[] | null;
  submissionInstructions: string | null;
}

export interface HomeworkSubmissionFile {
  id: string;
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  signedUrl: string | null;
  createdAt: string;
}

export interface HomeworkSubmission {
  id: string;
  assignmentId: string;
  clubId: string;
  classId: string | null;
  userId: string;
  studentName: string;
  submissionText: string | null;
  gradeStatus: HomeworkGradeStatus;
  score: number | null;
  scoreMax: number | null;
  rubricScores: Record<string, unknown>;
  feedback: string | null;
  submittedAt: string;
  gradedAt: string | null;
  files: HomeworkSubmissionFile[];
}

/**
 * A reservation the student started but never finalized. The submissions list
 * only carries `submission_state = 'submitted'` rows, so without this the UI
 * cannot even see an attempt stuck mid-upload — and `retryClubAssignmentSubmission`
 * has nothing to resume.
 */
export interface HomeworkPendingSubmissionFile {
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
}

export interface HomeworkPendingSubmission {
  id: string;
  state: Exclude<HomeworkSubmissionState, "submitted">;
  failureReason: string | null;
  submissionText: string | null;
  createdAt: string;
  files: HomeworkPendingSubmissionFile[];
}

export type HomeworkWorkspaceData =
  | {
      mode: "manager";
      viewerId: string;
      assignment: HomeworkAssignmentDetail;
      submissions: HomeworkSubmission[];
    }
  | {
      mode: "student";
      viewerId: string;
      assignment: HomeworkAssignmentDetail;
      submissions: HomeworkSubmission[];
      pendingSubmission: HomeworkPendingSubmission | null;
    };

type AssignmentRow = {
  id: string;
  club_id: string;
  class_id: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  required_attempts: number;
  status: string;
  submission_text_enabled: boolean;
  submission_files_enabled: boolean;
  submission_max_files: number;
  submission_max_file_mb: number;
  submission_allowed_ext: string[] | null;
  submission_instructions: string | null;
};

function normalizeGradeStatus(value: string): HomeworkGradeStatus {
  if (value === "graded" || value === "returned" || value === "resubmit_requested") return value;
  return "submitted";
}

async function loadClassTitle(supabase: IeltsServerClient, classId: string | null) {
  if (!classId) return null;
  const { data } = await supabase.from("classes").select("title").eq("id", classId).maybeSingle();
  return data?.title ?? null;
}

async function signedFileRows(
  supabase: IeltsServerClient,
  rows: Array<{
    id: string;
    storage_path: string;
    file_name: string;
    mime_type: string | null;
    size_bytes: number | null;
    created_at: string;
  }>,
): Promise<HomeworkSubmissionFile[]> {
  return Promise.all(
    rows.map(async (row) => {
      const { data, error } = await supabase.storage
        .from(HOMEWORK_BUCKET)
        .createSignedUrl(row.storage_path, 60 * 20);
      return {
        id: row.id,
        storagePath: row.storage_path,
        fileName: row.file_name,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        signedUrl: error ? null : data.signedUrl,
        createdAt: row.created_at,
      };
    }),
  );
}

async function decorateSubmissions(
  supabase: IeltsServerClient,
  rows: Array<{
    id: string;
    assignment_id: string;
    club_id: string;
    class_id: string | null;
    user_id: string;
    submission_text: string | null;
    grade_status: string;
    score: number | null;
    score_max: number | null;
    rubric_breakdown: unknown;
    feedback: string | null;
    submitted_at: string;
    graded_at: string | null;
  }>,
  isManager: boolean,
): Promise<HomeworkSubmission[]> {
  if (rows.length === 0) return [];

  const submissionIds = rows.map((row) => row.id);
  const filesRes = await (supabase as unknown as SupabaseClient)
      .from("assignment_submission_files")
      .select("id, submission_id, storage_path, file_name, mime_type, size_bytes, created_at, state")
      .in("submission_id", submissionIds)
      .eq("state", "verified")
      .order("created_at", { ascending: true });
  if (filesRes.error) throw new Error(filesRes.error.message);

  const profileById = new Map<string, string>();
  if (isManager) {
    const rpcClient = supabase as unknown as {
      rpc<T>(name: string, args: Record<string, unknown>): Promise<{ data: T | null; error: { message: string } | null }>;
    };
    const { data: roster, error: rosterError } = await rpcClient.rpc<Array<{ user_id: string; display_name: string }>>(
      "get_homework_submission_roster",
      { p_assignment_id: rows[0]?.assignment_id },
    );
    if (rosterError) throw new Error(rosterError.message);
    for (const profile of roster ?? []) profileById.set(profile.user_id, profile.display_name);
  }
  const signedFiles = await signedFileRows(supabase, (filesRes.data ?? []) as unknown as Array<{
    id: string;
    submission_id: string;
    storage_path: string;
    file_name: string;
    mime_type: string | null;
    size_bytes: number | null;
    created_at: string;
  }>);
  const filesBySubmission = new Map<string, HomeworkSubmissionFile[]>();
  for (const file of signedFiles) {
    const source = filesRes.data?.find((row) => row.id === file.id);
    if (!source) continue;
    const list = filesBySubmission.get(source.submission_id) ?? [];
    list.push(file);
    filesBySubmission.set(source.submission_id, list);
  }

  return rows.map((row) => ({
    id: row.id,
    assignmentId: row.assignment_id,
    clubId: row.club_id,
    classId: row.class_id,
    userId: row.user_id,
    studentName: profileById.get(row.user_id) ?? (isManager ? "Student" : "You"),
    submissionText: row.submission_text,
    gradeStatus: normalizeGradeStatus(row.grade_status),
    score: row.score,
    scoreMax: row.score_max,
    rubricScores:
      row.rubric_breakdown && typeof row.rubric_breakdown === "object" && !Array.isArray(row.rubric_breakdown)
        ? (row.rubric_breakdown as Record<string, unknown>)
        : {},
    feedback: row.feedback,
    submittedAt: row.submitted_at,
    gradedAt: row.graded_at,
    files: filesBySubmission.get(row.id) ?? [],
  }));
}

export async function getClubHomeworkWorkspace(
  clubId: string,
  assignmentId: string,
): Promise<HomeworkWorkspaceData | null> {
  const supabase = await createTypedServerClient();
  const viewerId = await getSessionUserId(supabase);

  const { data: assignment, error } = await supabase
    .from("club_assignments")
    .select("id, club_id, class_id, title, description, due_at, required_attempts, status, submission_text_enabled, submission_files_enabled, submission_max_files, submission_max_file_mb, submission_allowed_ext, submission_instructions")
    .eq("id", assignmentId)
    .eq("club_id", clubId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!assignment) return null;

  const assignmentRow = assignment as AssignmentRow;
  let isManager = false;
  try {
    if (assignmentRow.class_id) {
      await requireClassManager(supabase, assignmentRow.class_id);
    } else {
      await requireClubOwner(supabase, clubId);
    }
    isManager = true;
  } catch {
    isManager = false;
  }
  if (!isManager) {
    if (assignmentRow.class_id) {
      const { data: membership, error: membershipError } = await supabase
        .from("class_memberships")
        .select("id")
        .eq("class_id", assignmentRow.class_id)
        .eq("user_id", viewerId)
        .eq("member_role", "student")
        .eq("status", "active")
        .maybeSingle();
      if (membershipError) throw new Error(membershipError.message);
      if (!membership) return null;
    } else {
      // Club-wide assignment. RLS already restricts SELECT on club_assignments
      // for these rows, but the application boundary must not depend on that
      // alone — defence in depth for the `class_id IS NULL` case.
      const { data: clubMembership, error: clubMembershipError } = await supabase
        .from("club_memberships")
        .select("id")
        .eq("club_id", clubId)
        .eq("user_id", viewerId)
        .eq("status", "active")
        .maybeSingle();
      if (clubMembershipError) throw new Error(clubMembershipError.message);
      if (!clubMembership) return null;
    }
  }

  const detail: HomeworkAssignmentDetail = {
    id: assignmentRow.id,
    clubId: assignmentRow.club_id,
    classId: assignmentRow.class_id,
    classTitle: await loadClassTitle(supabase, assignmentRow.class_id),
    title: assignmentRow.title,
    description: assignmentRow.description,
    dueAt: assignmentRow.due_at,
    requiredAttempts: assignmentRow.required_attempts,
    status: assignmentRow.status,
    submissionTextEnabled: assignmentRow.submission_text_enabled,
    submissionFilesEnabled: assignmentRow.submission_files_enabled,
    submissionMaxFiles: assignmentRow.submission_max_files,
    submissionMaxFileMb: assignmentRow.submission_max_file_mb,
    submissionAllowedExt: assignmentRow.submission_allowed_ext,
    submissionInstructions: assignmentRow.submission_instructions,
  };

  const homeworkDb = supabase as unknown as SupabaseClient;
  let submissionsQuery = homeworkDb
    .from("club_assignment_submissions")
    .select("id, assignment_id, club_id, class_id, user_id, submission_text, grade_status, score, score_max, rubric_breakdown, feedback, submitted_at, graded_at")
    .eq("assignment_id", assignmentId)
    .eq("club_id", clubId)
    .eq("submission_state", "submitted")
    .order("submitted_at", { ascending: false });

  if (!isManager) {
    submissionsQuery = submissionsQuery.eq("user_id", viewerId);
  }

  const { data: submissions, error: submissionsError } = await submissionsQuery;
  if (submissionsError) throw new Error(submissionsError.message);

  const decorated = await decorateSubmissions(supabase, submissions ?? [], isManager);

  if (isManager) {
    return { mode: "manager", viewerId, assignment: detail, submissions: decorated };
  }

  return {
    mode: "student",
    viewerId,
    assignment: detail,
    submissions: decorated,
    pendingSubmission: await loadPendingSubmission(supabase, assignmentId, viewerId),
  };
}

/**
 * The newest reservation the learner started but never finalized. Only one is
 * surfaced: it is the only one they can resume, and older ones are the cleanup
 * worker's problem.
 */
async function loadPendingSubmission(
  supabase: IeltsServerClient,
  assignmentId: string,
  viewerId: string,
): Promise<HomeworkPendingSubmission | null> {
  const db = supabase as unknown as SupabaseClient;
  const { data: row, error } = await db
    .from("club_assignment_submissions")
    .select("id, submission_state, failure_reason, submission_text, created_at")
    .eq("assignment_id", assignmentId)
    .eq("user_id", viewerId)
    .in("submission_state", ["draft", "uploading", "failed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;

  const { data: files, error: filesError } = await db
    .from("assignment_submission_files")
    .select("storage_path, file_name, mime_type, size_bytes")
    .eq("submission_id", row.id)
    .eq("user_id", viewerId)
    .order("created_at", { ascending: true })
    .order("storage_path", { ascending: true });
  if (filesError) throw new Error(filesError.message);

  return {
    id: row.id,
    state: row.submission_state as HomeworkPendingSubmission["state"],
    failureReason: row.failure_reason ?? null,
    submissionText: row.submission_text ?? null,
    createdAt: row.created_at,
    files: (files ?? []).map((file) => ({
      storagePath: file.storage_path,
      fileName: file.file_name,
      mimeType: file.mime_type,
      sizeBytes: file.size_bytes == null ? null : Number(file.size_bytes),
    })),
  };
}
