import "server-only";

import { createTypedServerClient } from "@/lib/supabase/server";
import { getSessionUserId, requireClubManager, type IeltsServerClient } from "@/lib/api/ielts/assignment-access";

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
): Promise<HomeworkSubmission[]> {
  if (rows.length === 0) return [];

  const submissionIds = rows.map((row) => row.id);
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const [profilesRes, filesRes] = await Promise.all([
    supabase.from("profiles").select("id, display_name, email").in("id", userIds),
    supabase
      .from("assignment_submission_files")
      .select("id, submission_id, storage_path, file_name, mime_type, size_bytes, created_at")
      .in("submission_id", submissionIds)
      .order("created_at", { ascending: true }),
  ]);
  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (filesRes.error) throw new Error(filesRes.error.message);

  const profileById = new Map(
    (profilesRes.data ?? []).map((profile) => [
      profile.id,
      String(profile.display_name ?? profile.email ?? "Student"),
    ]),
  );
  const signedFiles = await signedFileRows(supabase, filesRes.data ?? []);
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
    studentName: profileById.get(row.user_id) ?? "Student",
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
  let isManager = false;
  try {
    await requireClubManager(supabase, clubId);
    isManager = true;
  } catch {
    isManager = false;
  }

  const { data: assignment, error } = await supabase
    .from("club_assignments")
    .select("id, club_id, class_id, title, description, due_at, required_attempts, status, submission_text_enabled, submission_files_enabled, submission_max_files, submission_max_file_mb, submission_allowed_ext, submission_instructions")
    .eq("id", assignmentId)
    .eq("club_id", clubId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!assignment) return null;

  const assignmentRow = assignment as AssignmentRow;
  if (!isManager && assignmentRow.class_id) {
    const { data: membership, error: membershipError } = await supabase
      .from("class_memberships")
      .select("id")
      .eq("class_id", assignmentRow.class_id)
      .eq("user_id", viewerId)
      .eq("status", "active")
      .maybeSingle();
    if (membershipError) throw new Error(membershipError.message);
    if (!membership) return null;
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

  let submissionsQuery = supabase
    .from("club_assignment_submissions")
    .select("id, assignment_id, club_id, class_id, user_id, submission_text, grade_status, score, score_max, rubric_breakdown, feedback, submitted_at, graded_at")
    .eq("assignment_id", assignmentId)
    .eq("club_id", clubId)
    .order("submitted_at", { ascending: false });

  if (!isManager) {
    submissionsQuery = submissionsQuery.eq("user_id", viewerId);
  }

  const { data: submissions, error: submissionsError } = await submissionsQuery;
  if (submissionsError) throw new Error(submissionsError.message);

  return {
    mode: isManager ? "manager" : "student",
    viewerId,
    assignment: detail,
    submissions: await decorateSubmissions(supabase, submissions ?? []),
  } as HomeworkWorkspaceData;
}
