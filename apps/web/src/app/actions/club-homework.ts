"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { parseInput } from "@/lib/api/boundary";
import {
  GradeAssignmentSubmissionSchema,
  RecordAssignmentSubmissionFilesSchema,
  SubmitClubAssignmentSchema,
} from "@/lib/api/club-homework-schema";
import { getSessionUserId, requireClubManager } from "@/lib/api/ielts/assignment-access";
import { createTypedServerClient } from "@/lib/supabase/server";

const HOMEWORK_BUCKET = "assignment-submissions";
const DEFAULT_ALLOWED_EXT = ["pdf", "doc", "docx", "png", "jpg", "jpeg", "mp3", "m4a", "wav"];

type HomeworkFileInput = {
  fileName: string;
  mimeType?: string | null;
  sizeBytes: number;
};

function fileExtension(fileName: string) {
  const sanitized = fileName.trim().toLowerCase();
  const index = sanitized.lastIndexOf(".");
  return index >= 0 ? sanitized.slice(index + 1).replace(/[^a-z0-9]/g, "") : "";
}

function safeFileName(fileName: string) {
  const cleaned = fileName
    .trim()
    .replace(/[\\/]/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 140);
  return cleaned || "submission-file";
}

function allowedExtensions(raw: string[] | null) {
  return raw?.length ? raw.map((ext) => ext.toLowerCase().replace(/^\./, "")) : DEFAULT_ALLOWED_EXT;
}

function validateFiles(input: {
  files: HomeworkFileInput[];
  filesEnabled: boolean;
  maxFiles: number;
  maxFileMb: number;
  allowedExt: string[];
}) {
  if (input.files.length === 0) return;
  if (!input.filesEnabled) throw new Error("This assignment does not accept files.");
  if (input.files.length > input.maxFiles) throw new Error(`Upload at most ${input.maxFiles} files.`);

  const maxBytes = input.maxFileMb * 1024 * 1024;
  for (const file of input.files) {
    const ext = fileExtension(file.fileName);
    if (!ext || !input.allowedExt.includes(ext)) {
      throw new Error(`File type .${ext || "unknown"} is not allowed.`);
    }
    if (file.sizeBytes > maxBytes) {
      throw new Error(`${file.fileName} is larger than ${input.maxFileMb}MB.`);
    }
  }
}

async function loadAssignmentForSubmit(supabase: Awaited<ReturnType<typeof createTypedServerClient>>, assignmentId: string) {
  const { data, error } = await supabase
    .from("club_assignments")
    .select("id, club_id, class_id, status, due_at, required_attempts, submission_text_enabled, submission_files_enabled, submission_max_files, submission_max_file_mb, submission_allowed_ext")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Assignment not found.");
  return data;
}

export async function submitClubAssignment(raw: unknown) {
  const input = parseInput(SubmitClubAssignmentSchema, raw);
  const supabase = await createTypedServerClient();
  const userId = await getSessionUserId(supabase);
  const assignment = await loadAssignmentForSubmit(supabase, input.assignmentId);

  if (assignment.status !== "active") throw new Error("This assignment is not accepting submissions.");
  if (assignment.due_at && new Date(assignment.due_at).getTime() < Date.now()) {
    throw new Error("This assignment is past due.");
  }

  if (assignment.class_id) {
    const { data: membership, error: membershipError } = await supabase
      .from("class_memberships")
      .select("id")
      .eq("class_id", assignment.class_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (membershipError) throw new Error(membershipError.message);
    if (!membership) throw new Error("You are not enrolled in this class.");
  }

  const submissionText = input.submissionText?.trim() ?? "";
  if (submissionText && !assignment.submission_text_enabled) {
    throw new Error("This assignment does not accept text responses.");
  }

  const allowedExt = allowedExtensions(assignment.submission_allowed_ext);
  validateFiles({
    files: input.files,
    filesEnabled: assignment.submission_files_enabled,
    maxFiles: assignment.submission_max_files,
    maxFileMb: assignment.submission_max_file_mb,
    allowedExt,
  });

  if (!submissionText && input.files.length === 0) {
    throw new Error("Add text or at least one file before submitting.");
  }

  const { data: previous, error: previousError } = await supabase
    .from("club_assignment_submissions")
    .select("id, grade_status")
    .eq("assignment_id", assignment.id)
    .eq("user_id", userId);
  if (previousError) throw new Error(previousError.message);

  const canResubmit = (previous ?? []).some((row) => row.grade_status === "resubmit_requested");
  if (!canResubmit && (previous?.length ?? 0) >= assignment.required_attempts) {
    throw new Error("You have already submitted the required attempts.");
  }

  const uploadTargets = await Promise.all(
    input.files.map(async (file) => {
      const storagePath = `${assignment.club_id}/${assignment.id}/${userId}/${randomUUID()}-${safeFileName(file.fileName)}`;
      const { data, error } = await supabase.storage
        .from(HOMEWORK_BUCKET)
        .createSignedUploadUrl(storagePath);
      if (error) throw new Error(error.message);
      return {
        storagePath,
        fileName: file.fileName,
        mimeType: file.mimeType ?? null,
        sizeBytes: file.sizeBytes,
        token: data.token,
        signedUrl: data.signedUrl,
      };
    }),
  );

  const { data: submission, error } = await supabase
    .from("club_assignment_submissions")
    .insert({
      assignment_id: assignment.id,
      club_id: assignment.club_id,
      class_id: assignment.class_id,
      user_id: userId,
      source_type: "homework",
      source_id: null,
      submission_text: submissionText || null,
      status: "submitted",
      grade_status: "submitted",
      metadata: { file_count: input.files.length },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/clubs/${assignment.club_id}`);
  revalidatePath(`/dashboard/clubs/${assignment.club_id}/assignments/${assignment.id}`);
  return { submissionId: submission.id, uploadTargets };
}

export async function recordAssignmentSubmissionFiles(raw: unknown) {
  const input = parseInput(RecordAssignmentSubmissionFilesSchema, raw);
  if (input.files.length === 0) return;

  const supabase = await createTypedServerClient();
  const userId = await getSessionUserId(supabase);
  const { data: submission, error: submissionError } = await supabase
    .from("club_assignment_submissions")
    .select("id, assignment_id, club_id, user_id")
    .eq("id", input.submissionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (submissionError) throw new Error(submissionError.message);
  if (!submission) throw new Error("Submission not found.");

  const assignment = await loadAssignmentForSubmit(supabase, submission.assignment_id);
  const allowedExt = allowedExtensions(assignment.submission_allowed_ext);
  validateFiles({
    files: input.files,
    filesEnabled: assignment.submission_files_enabled,
    maxFiles: assignment.submission_max_files,
    maxFileMb: assignment.submission_max_file_mb,
    allowedExt,
  });

  const prefix = `${submission.club_id}/${submission.assignment_id}/${userId}/`;
  const rows = input.files.map((file) => {
    if (!file.storagePath.startsWith(prefix)) throw new Error("Invalid upload path.");
    return {
      submission_id: submission.id,
      club_id: submission.club_id,
      user_id: userId,
      storage_path: file.storagePath,
      file_name: file.fileName,
      mime_type: file.mimeType ?? null,
      size_bytes: file.sizeBytes,
    };
  });

  const { error } = await supabase.from("assignment_submission_files").insert(rows);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/clubs/${submission.club_id}/assignments/${submission.assignment_id}`);
}

export async function gradeAssignmentSubmission(raw: unknown) {
  const input = parseInput(GradeAssignmentSubmissionSchema, raw);
  const supabase = await createTypedServerClient();
  const managerId = await requireClubManager(supabase, input.clubId);

  if (input.score != null && input.scoreMax != null && input.score > input.scoreMax) {
    throw new Error("Score cannot be greater than max score.");
  }

  const { data: submission, error: submissionError } = await supabase
    .from("club_assignment_submissions")
    .select("id, assignment_id, club_id")
    .eq("id", input.submissionId)
    .eq("club_id", input.clubId)
    .maybeSingle();
  if (submissionError) throw new Error(submissionError.message);
  if (!submission) throw new Error("Submission not found.");

  const { error } = await supabase
    .from("club_assignment_submissions")
    .update({
      grade_status: input.gradeStatus,
      score: input.score ?? null,
      score_max: input.scoreMax ?? null,
      rubric_breakdown: input.rubricScores,
      feedback: input.feedback?.trim() || null,
      graded_by: managerId,
      graded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.submissionId)
    .eq("club_id", input.clubId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/clubs/${input.clubId}`);
  revalidatePath(`/dashboard/clubs/${input.clubId}/assignments/${submission.assignment_id}`);
}
