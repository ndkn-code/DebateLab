"use server";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { parseInput } from "@/lib/api/boundary";
import {
  GradeAssignmentSubmissionSchema,
  FailAssignmentSubmissionSchema,
  RecordAssignmentSubmissionFilesSchema,
  SubmitClubAssignmentSchema,
} from "@/lib/api/club-homework-schema";
import { getSessionUserId } from "@/lib/api/ielts/assignment-access";
import { requireClassManager, requireClubOwner } from "@/lib/api/class-manager-access";
import { createTypedServerClient } from "@/lib/supabase/server";

const HOMEWORK_BUCKET = "assignment-submissions";
const DEFAULT_ALLOWED_EXT = ["pdf", "doc", "docx", "png", "jpg", "jpeg", "mp3", "m4a", "wav"];

type HomeworkFileInput = {
  fileName: string;
  mimeType?: string | null;
  sizeBytes: number;
};

type HomeworkRpcClient = {
  rpc<T>(name: string, args: Record<string, unknown>): Promise<{
    data: T | null;
    error: { message: string } | null;
  }>;
};

type HomeworkFileIntent = HomeworkFileInput & { storagePath: string };

function homeworkRpc(supabase: Awaited<ReturnType<typeof createTypedServerClient>>) {
  return supabase as unknown as HomeworkRpcClient;
}

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
      .eq("member_role", "student")
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

  const idempotencyKey = input.idempotencyKey ?? randomUUID();
  const fileIntents: HomeworkFileIntent[] = input.files.map((file) => ({
    ...file,
    mimeType: file.mimeType ?? null,
    storagePath: `${assignment.club_id}/${assignment.id}/${userId}/${randomUUID()}-${safeFileName(file.fileName)}`,
  }));
  const { data: submissionId, error: reserveError } = await homeworkRpc(supabase).rpc<string>(
    "reserve_homework_submission",
    {
      p_assignment_id: assignment.id,
      p_user_id: userId,
      p_idempotency_key: idempotencyKey,
      p_submission_text: submissionText || null,
      p_file_intents: fileIntents,
    },
  );
  if (reserveError || !submissionId) throw new Error(reserveError?.message ?? "Unable to reserve submission.");

  const db = supabase as unknown as SupabaseClient;
  const { data: reservedSubmission, error: reservedSubmissionError } = await db
    .from("club_assignment_submissions")
    .select("submission_state")
    .eq("id", submissionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (reservedSubmissionError) throw new Error(reservedSubmissionError.message);
  if (reservedSubmission?.submission_state === "failed") throw new Error("Submission has been cancelled.");
  if (reservedSubmission?.submission_state === "submitted") {
    return { submissionId, uploadTargets: [] };
  }

  const { data: intents, error: intentsError } = await supabase
    .from("assignment_submission_files")
    .select("storage_path, file_name, mime_type, size_bytes")
    .eq("submission_id", submissionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (intentsError) throw new Error(intentsError.message);

  let uploadTargets: Array<{
    storagePath: string;
    fileName: string;
    mimeType: string | null;
    sizeBytes: number;
    token: string;
    signedUrl: string;
  }>;
  try {
    uploadTargets = await Promise.all(
      (intents ?? []).map(async (file) => {
        const { data, error } = await supabase.storage
          .from(HOMEWORK_BUCKET)
          .createSignedUploadUrl(file.storage_path);
        if (error) throw new Error(error.message);
        return {
          storagePath: file.storage_path,
          fileName: file.file_name,
          mimeType: file.mime_type,
          sizeBytes: file.size_bytes ?? 0,
          token: data.token,
          signedUrl: data.signedUrl,
        };
      }),
    );
  } catch (error) {
    await homeworkRpc(supabase).rpc<string>("fail_homework_submission", {
      p_submission_id: submissionId,
      p_user_id: userId,
      p_reason: error instanceof Error ? error.message : "Upload reservation failed",
    });
    throw error;
  }
  const { error: uploadingError } = await homeworkRpc(supabase).rpc<string>("mark_homework_submission_uploading", {
    p_submission_id: submissionId,
    p_user_id: userId,
  });
  if (uploadingError) {
    await homeworkRpc(supabase).rpc<string>("fail_homework_submission", {
      p_submission_id: submissionId,
      p_user_id: userId,
      p_reason: uploadingError.message,
    });
    throw new Error(uploadingError.message);
  }

  revalidatePath(`/dashboard/clubs/${assignment.club_id}`);
  revalidatePath(`/dashboard/clubs/${assignment.club_id}/assignments/${assignment.id}`);
  return { submissionId, uploadTargets };
}

export async function recordAssignmentSubmissionFiles(raw: unknown) {
  const input = parseInput(RecordAssignmentSubmissionFilesSchema, raw);
  const supabase = await createTypedServerClient();
  const userId = await getSessionUserId(supabase);
  const db = supabase as unknown as SupabaseClient;
  const { data: submission, error: submissionError } = await db
    .from("club_assignment_submissions")
    .select("id, assignment_id, club_id, user_id, submission_state")
    .eq("id", input.submissionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (submissionError) throw new Error(submissionError.message);
  if (!submission) throw new Error("Submission not found.");
  if (submission.submission_state === "submitted") return { submissionId: submission.id };
  if (submission.submission_state === "failed") throw new Error("Submission has been cancelled.");
  if (input.files.length === 0) throw new Error("File metadata is required to finalize this submission.");

  const assignment = await loadAssignmentForSubmit(supabase, submission.assignment_id);
  const allowedExt = allowedExtensions(assignment.submission_allowed_ext);
  validateFiles({
    files: input.files,
    filesEnabled: assignment.submission_files_enabled,
    maxFiles: assignment.submission_max_files,
    maxFileMb: assignment.submission_max_file_mb,
    allowedExt,
  });

  const { data: expectedRows, error: expectedError } = await supabase
    .from("assignment_submission_files")
    .select("storage_path, file_name, mime_type, size_bytes")
    .eq("submission_id", submission.id)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (expectedError) throw new Error(expectedError.message);
  if ((expectedRows?.length ?? 0) !== input.files.length) throw new Error("File set does not match the reservation.");

  const expectedByPath = new Map((expectedRows ?? []).map((row) => [row.storage_path, row]));
  const prefix = `${submission.club_id}/${submission.assignment_id}/${userId}/`;
  for (const file of input.files) {
    if (!file.storagePath.startsWith(prefix) || file.storagePath.includes("..")) {
      throw new Error("Invalid upload path.");
    }
    const expected = expectedByPath.get(file.storagePath);
    if (!expected || expected.file_name !== file.fileName || (expected.mime_type ?? null) !== (file.mimeType ?? null) || Number(expected.size_bytes ?? -1) !== file.sizeBytes) {
      throw new Error("File metadata does not match the reservation.");
    }
  }

  const { data: finalizedId, error: finalizeError } = await homeworkRpc(supabase).rpc<string>(
    "finalize_homework_submission",
    {
      p_submission_id: submission.id,
      p_user_id: userId,
      p_storage_paths: input.files.map((file) => file.storagePath),
    },
  );
  if (finalizeError || !finalizedId) throw new Error(finalizeError?.message ?? "Unable to finalize submission.");

  revalidatePath(`/dashboard/clubs/${submission.club_id}/assignments/${submission.assignment_id}`);
  return { submissionId: finalizedId };
}

export async function failClubAssignmentSubmission(raw: unknown) {
  const input = parseInput(FailAssignmentSubmissionSchema, raw);
  const supabase = await createTypedServerClient();
  const userId = await getSessionUserId(supabase);
  const db = supabase as unknown as SupabaseClient;
  const { data: files } = await db
    .from("assignment_submission_files")
    .select("storage_path, state")
    .eq("submission_id", input.submissionId)
    .eq("user_id", userId)
    .eq("state", "pending");
  if (files?.length) {
    await supabase.storage.from(HOMEWORK_BUCKET).remove(files.map((file) => file.storage_path));
  }
  const { data: failedId, error } = await homeworkRpc(supabase).rpc<string>("fail_homework_submission", {
    p_submission_id: input.submissionId,
    p_user_id: userId,
    p_reason: input.reason ?? null,
  });
  if (error || !failedId) throw new Error(error?.message ?? "Unable to cancel submission.");
  return { submissionId: failedId };
}

export async function gradeAssignmentSubmission(raw: unknown) {
  const input = parseInput(GradeAssignmentSubmissionSchema, raw);
  const supabase = await createTypedServerClient();

  if (input.score != null && input.scoreMax != null && input.score > input.scoreMax) {
    throw new Error("Score cannot be greater than max score.");
  }

  const { data: submission, error: submissionError } = await supabase
    .from("club_assignment_submissions")
    .select("id, assignment_id, club_id, class_id")
    .eq("id", input.submissionId)
    .eq("club_id", input.clubId)
    .maybeSingle();
  if (submissionError) throw new Error(submissionError.message);
  if (!submission) throw new Error("Submission not found.");
  if (submission.class_id) {
    await requireClassManager(supabase, submission.class_id);
  } else {
    await requireClubOwner(supabase, input.clubId);
  }

  const { error } = await homeworkRpc(supabase).rpc<string>("grade_homework_submission", {
    p_submission_id: input.submissionId,
    p_club_id: input.clubId,
    p_grade_status: input.gradeStatus,
    p_score: input.score ?? null,
    p_score_max: input.scoreMax ?? null,
    p_rubric_breakdown: input.rubricScores,
    p_feedback: input.feedback?.trim() || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/clubs/${input.clubId}`);
  revalidatePath(`/dashboard/clubs/${input.clubId}/assignments/${submission.assignment_id}`);
}
