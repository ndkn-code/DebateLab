"use server";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { parseInput } from "@/lib/api/boundary";
import {
  GradeAssignmentSubmissionSchema,
  FailAssignmentSubmissionSchema,
  RecordAssignmentSubmissionFilesSchema,
  RetryAssignmentSubmissionSchema,
  SubmitClubAssignmentSchema,
} from "@/lib/api/club-homework-schema";
import {
  canonicalMimeType,
  homeworkFileExtension,
  normalizeAllowedExtensions,
} from "@/lib/api/club-homework-files";
import { sameHomeworkMime } from "@/lib/api/club-homework-model";
import { getSessionUserId } from "@/lib/api/ielts/assignment-access";
import { requireClassManager, requireClubOwner } from "@/lib/api/class-manager-access";
import { createTypedServerClient } from "@/lib/supabase/server";

const HOMEWORK_BUCKET = "assignment-submissions";

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

type HomeworkFileIntent = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
};

type ReservedFileRow = {
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
};

type HomeworkUploadTarget = {
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  token: string;
  signedUrl: string;
};

type HomeworkServerClient = Awaited<ReturnType<typeof createTypedServerClient>>;

function homeworkRpc(supabase: HomeworkServerClient) {
  return supabase as unknown as HomeworkRpcClient;
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

/**
 * The assignment's configured extensions, intersected with what the
 * `assignment-submissions` bucket actually accepts. A teacher typing `heic`
 * must not create an assignment whose uploads storage rejects after the fact.
 */
function allowedExtensions(raw: string[] | null) {
  return normalizeAllowedExtensions(raw);
}

/**
 * Errors thrown from this module are stable codes (optionally `CODE|detail`),
 * mirroring the codes the homework RPCs raise. The student surface owns the
 * bilingual copy for them; none of these should ever be rendered verbatim.
 */
function validateFiles(input: {
  files: HomeworkFileInput[];
  filesEnabled: boolean;
  maxFiles: number;
  maxFileMb: number;
  allowedExt: string[];
}) {
  if (input.files.length === 0) return;
  if (!input.filesEnabled) throw new Error("FILES_NOT_ACCEPTED");
  if (input.files.length > input.maxFiles) throw new Error(`TOO_MANY_FILES|${input.maxFiles}`);

  const maxBytes = input.maxFileMb * 1024 * 1024;
  for (const file of input.files) {
    const ext = homeworkFileExtension(file.fileName);
    // No canonical MIME means the storage allowlist would reject the object,
    // so the reservation must fail here rather than after the upload.
    if (!ext || !input.allowedExt.includes(ext) || !canonicalMimeType(file.fileName)) {
      throw new Error(`FILE_TYPE_NOT_ALLOWED|${file.fileName}|${ext}`);
    }
    if (file.sizeBytes > maxBytes) {
      throw new Error(`FILE_TOO_LARGE|${file.fileName}|${input.maxFileMb}`);
    }
  }
}

async function loadAssignmentForSubmit(supabase: HomeworkServerClient, assignmentId: string) {
  const { data, error } = await supabase
    .from("club_assignments")
    .select("id, club_id, class_id, status, due_at, required_attempts, submission_text_enabled, submission_files_enabled, submission_max_files, submission_max_file_mb, submission_allowed_ext")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("ASSIGNMENT_NOT_FOUND");
  return data;
}

async function signUploadTargets(
  supabase: HomeworkServerClient,
  rows: ReservedFileRow[],
): Promise<HomeworkUploadTarget[]> {
  return Promise.all(
    rows.map(async (file) => {
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
}

/**
 * Reserved rows are inserted in one statement, so `created_at` ties and the
 * database order is not deterministic. The client pairs upload target N with
 * its file N, so the targets must follow the caller's file order exactly —
 * otherwise, with two or more files, bytes land on each other's paths.
 * `storagePath` is unique and generated in input order, so it is the key.
 */
function orderReservedRows(rows: ReservedFileRow[], intents: HomeworkFileIntent[]): ReservedFileRow[] {
  const byPath = new Map(rows.map((row) => [row.storage_path, row]));
  return intents.map((intent) => {
    const row = byPath.get(intent.storagePath);
    if (!row) throw new Error("FILE_SET_MISMATCH");
    return row;
  });
}

export async function submitClubAssignment(raw: unknown) {
  const input = parseInput(SubmitClubAssignmentSchema, raw);
  const supabase = await createTypedServerClient();
  const userId = await getSessionUserId(supabase);
  const assignment = await loadAssignmentForSubmit(supabase, input.assignmentId);

  if (assignment.status !== "active") throw new Error("ASSIGNMENT_NOT_ACCEPTING_SUBMISSIONS");

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
    if (!membership) throw new Error("NOT_ENROLLED");
  }

  const submissionText = input.submissionText?.trim() ?? "";
  if (submissionText && !assignment.submission_text_enabled) {
    throw new Error("TEXT_NOT_ACCEPTED");
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
    throw new Error("EMPTY_SUBMISSION");
  }

  // The deadline is enforced inside `reserve_homework_submission`, deliberately
  // *after* it resolves a `resubmit_requested` predecessor: a revision the
  // teacher explicitly asked for must survive the due date, a first attempt must
  // not. Re-checking it here would reinstate the lock-out this card removed.
  const idempotencyKey = input.idempotencyKey ?? randomUUID();
  // The browser-reported `File.type` is never trusted: it is empty for .m4a and
  // for many .docx, and supabase-js then uploads as text/plain, which fails
  // `finalize_homework_submission`'s STORAGE_OBJECT_MIME_MISMATCH check *after*
  // the bytes have landed. Extension -> canonical MIME, identically both sides.
  const fileIntents: HomeworkFileIntent[] = input.files.map((file) => {
    const mimeType = canonicalMimeType(file.fileName);
    if (!mimeType) {
      throw new Error(`FILE_TYPE_NOT_ALLOWED|${file.fileName}|${homeworkFileExtension(file.fileName)}`);
    }
    return {
      fileName: file.fileName,
      sizeBytes: file.sizeBytes,
      mimeType,
      storagePath: `${assignment.club_id}/${assignment.id}/${userId}/${randomUUID()}-${safeFileName(file.fileName)}`,
    };
  });
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
  if (reserveError || !submissionId) throw new Error(reserveError?.message ?? "SUBMISSION_RESERVE_FAILED");

  const db = supabase as unknown as SupabaseClient;
  const { data: reservedSubmission, error: reservedSubmissionError } = await db
    .from("club_assignment_submissions")
    .select("submission_state")
    .eq("id", submissionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (reservedSubmissionError) throw new Error(reservedSubmissionError.message);
  if (reservedSubmission?.submission_state === "failed") throw new Error("SUBMISSION_CANCELLED");
  if (reservedSubmission?.submission_state === "submitted") {
    return { submissionId, uploadTargets: [] as HomeworkUploadTarget[] };
  }

  const { data: intents, error: intentsError } = await supabase
    .from("assignment_submission_files")
    .select("storage_path, file_name, mime_type, size_bytes")
    .eq("submission_id", submissionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (intentsError) throw new Error(intentsError.message);

  let uploadTargets: HomeworkUploadTarget[];
  try {
    uploadTargets = await signUploadTargets(supabase, orderReservedRows(intents ?? [], fileIntents));
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
  if (!submission) throw new Error("SUBMISSION_NOT_FOUND");
  if (submission.submission_state === "submitted") return { submissionId: submission.id };
  if (submission.submission_state === "failed") throw new Error("SUBMISSION_CANCELLED");
  if (input.files.length === 0) throw new Error("FILE_SET_MISMATCH");

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
  if ((expectedRows?.length ?? 0) !== input.files.length) throw new Error("FILE_SET_MISMATCH");

  const expectedByPath = new Map((expectedRows ?? []).map((row) => [row.storage_path, row]));
  const prefix = `${submission.club_id}/${submission.assignment_id}/${userId}/`;
  for (const file of input.files) {
    if (!file.storagePath.startsWith(prefix) || file.storagePath.includes("..")) {
      throw new Error("INVALID_UPLOAD_PATH");
    }
    const expected = expectedByPath.get(file.storagePath);
    if (
      !expected ||
      expected.file_name !== file.fileName ||
      !sameHomeworkMime(expected.mime_type, file.mimeType) ||
      Number(expected.size_bytes ?? -1) !== file.sizeBytes
    ) {
      throw new Error("FILE_METADATA_MISMATCH");
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
  if (finalizeError || !finalizedId) throw new Error(finalizeError?.message ?? "SUBMISSION_FINALIZE_FAILED");

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
  if (error || !failedId) throw new Error(error?.message ?? "SUBMISSION_CANCEL_FAILED");
  return { submissionId: failedId };
}

/**
 * Resume an unfinished reservation without consuming another attempt.
 *
 * A student whose upload died mid-flight is left with a `draft` / `uploading`
 * (or `failed`, once the cleanup worker ran) submission that the happy path can
 * never finish. This mints fresh signed upload URLs for the rows already
 * reserved, so the browser can re-upload the same files into the same attempt.
 *
 * `retry_homework_submission` only accepts a `failed` submission whose blobs
 * the cleanup worker already removed, so the draft/uploading case is resumed
 * directly here: students have no storage UPDATE policy, so any partially
 * uploaded object must be dropped before a signed URL can insert it again.
 */
export async function retryClubAssignmentSubmission(raw: unknown) {
  const input = parseInput(RetryAssignmentSubmissionSchema, raw);
  const supabase = await createTypedServerClient();
  const userId = await getSessionUserId(supabase);
  const db = supabase as unknown as SupabaseClient;
  const { data: submission, error: submissionError } = await db
    .from("club_assignment_submissions")
    .select("id, assignment_id, club_id, submission_state")
    .eq("id", input.submissionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (submissionError) throw new Error(submissionError.message);
  if (!submission) throw new Error("SUBMISSION_NOT_FOUND");
  if (submission.submission_state === "submitted") throw new Error("ALREADY_SUBMITTED");

  const assignment = await loadAssignmentForSubmit(supabase, submission.assignment_id);
  if (assignment.status !== "active") throw new Error("ASSIGNMENT_NOT_ACCEPTING_SUBMISSIONS");
  // Deliberately no due-date guard: the attempt was reserved before the
  // deadline and only our upload failed. Finishing it is not a late submission.

  let resumableId: string = submission.id;
  if (submission.submission_state === "failed") {
    const { data: retriedId, error: retryError } = await homeworkRpc(supabase).rpc<string>(
      "retry_homework_submission",
      { p_submission_id: input.submissionId, p_user_id: userId },
    );
    if (retryError || !retriedId) {
      throw new Error(retryError?.message ?? "SUBMISSION_RETRY_FAILED");
    }
    resumableId = retriedId;
  }

  const { data: files, error: filesError } = await supabase
    .from("assignment_submission_files")
    .select("storage_path, file_name, mime_type, size_bytes")
    .eq("submission_id", resumableId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .order("storage_path", { ascending: true });
  if (filesError) throw new Error(filesError.message);
  const reserved = (files ?? []) as ReservedFileRow[];
  if (reserved.length === 0) throw new Error("FILE_SET_MISMATCH");
  // Reservations made before the canonical-MIME fix recorded a NULL mime type,
  // which no HTTP upload can ever match at finalize time. Not resumable.
  if (reserved.some((row) => !row.mime_type)) throw new Error("RESERVATION_NOT_RESUMABLE");

  if (submission.submission_state !== "failed") {
    const { error: removeError } = await supabase.storage
      .from(HOMEWORK_BUCKET)
      .remove(reserved.map((row) => row.storage_path));
    if (removeError) throw new Error(removeError.message);
  }

  const uploadTargets = await signUploadTargets(supabase, reserved);
  const { error: uploadingError } = await homeworkRpc(supabase).rpc<string>("mark_homework_submission_uploading", {
    p_submission_id: resumableId,
    p_user_id: userId,
  });
  if (uploadingError) throw new Error(uploadingError.message);

  return { submissionId: resumableId, uploadTargets };
}

export async function gradeAssignmentSubmission(raw: unknown) {
  const input = parseInput(GradeAssignmentSubmissionSchema, raw);
  const supabase = await createTypedServerClient();

  if (input.score != null && input.scoreMax != null && input.score > input.scoreMax) {
    throw new Error("SCORE_ABOVE_MAX");
  }

  const { data: submission, error: submissionError } = await supabase
    .from("club_assignment_submissions")
    .select("id, assignment_id, club_id, class_id")
    .eq("id", input.submissionId)
    .eq("club_id", input.clubId)
    .maybeSingle();
  if (submissionError) throw new Error(submissionError.message);
  if (!submission) throw new Error("SUBMISSION_NOT_FOUND");
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
