"use client";

import { useMemo, useRef, useState, useTransition, type DragEvent, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Download,
  FileText,
  Loader2,
  Paperclip,
  RefreshCw,
  Save,
  Send,
  Trash2,
} from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import {
  failClubAssignmentSubmission,
  gradeAssignmentSubmission,
  recordAssignmentSubmissionFiles,
  retryClubAssignmentSubmission,
  submitClubAssignment,
} from "@/app/actions/club-homework";
import {
  canonicalMimeType,
  homeworkAcceptAttribute,
  homeworkFileExtension,
  normalizeAllowedExtensions,
} from "@/lib/api/club-homework-files";
import { createTypedBrowserClient } from "@/lib/supabase/client";
import { AnimatedNumber, SuccessCheck } from "@/components/motion";
import { showToast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";
import type {
  HomeworkGradeStatus,
  HomeworkPendingSubmission,
  HomeworkSubmission,
  HomeworkWorkspaceData,
} from "@/lib/api/club-homework";

const RUBRIC_KEYS = ["clarity", "logic", "evidence", "delivery"] as const;
const HOMEWORK_BUCKET = "assignment-submissions";

function formatDate(value: string | null, locale: string, vi: boolean) {
  if (!value) return vi ? "Không có hạn nộp" : "No due date";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null, locale: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(value: number | null) {
  if (value == null) return "-";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))}KB`;
  return `${(value / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * The homework RPCs raise bare codes (`ATTEMPTS_EXHAUSTED`, …) and the server
 * action mirrors them, so without this a learner reads the code itself in a
 * toast. PostgREST may wrap the code in its own sentence, so match on
 * substring; anything unrecognized falls back to plain language rather than
 * leaking a code or a database message.
 */
function homeworkErrorMessage(error: unknown, vi: boolean): string {
  const raw = error instanceof Error ? error.message : "";

  const fileTooLarge = /FILE_TOO_LARGE\|([^|]+)\|([0-9]+)/.exec(raw);
  if (fileTooLarge) {
    return vi
      ? `"${fileTooLarge[1]}" vượt quá ${fileTooLarge[2]}MB.`
      : `"${fileTooLarge[1]}" is larger than ${fileTooLarge[2]}MB.`;
  }
  const fileType = /FILE_TYPE_NOT_ALLOWED\|([^|]+)\|([a-z0-9]*)/.exec(raw);
  if (fileType) {
    return vi
      ? `Không hỗ trợ định dạng của "${fileType[1]}".`
      : `"${fileType[1]}" is not a supported file type.`;
  }
  const tooMany = /TOO_MANY_FILES\|([0-9]+)/.exec(raw);
  if (tooMany) {
    return vi ? `Chỉ được tải lên tối đa ${tooMany[1]} tệp.` : `Upload at most ${tooMany[1]} files.`;
  }
  const resumeMissing = /RESUME_FILE_MISSING\|(.+)$/.exec(raw);
  if (resumeMissing) {
    return vi
      ? `Hãy chọn đúng tệp "${resumeMissing[1]}" của lần nộp trước.`
      : `Pick the same file "${resumeMissing[1]}" from the interrupted upload.`;
  }

  const codes: Array<[string, string, string]> = [
    [
      "ASSIGNMENT_NOT_ACCEPTING_SUBMISSIONS",
      "Bài tập này hiện không nhận bài nộp.",
      "This assignment is not accepting submissions.",
    ],
    ["ASSIGNMENT_PAST_DUE", "Bài tập đã quá hạn nộp.", "This assignment is past due."],
    [
      "ATTEMPTS_EXHAUSTED",
      "Bạn đã dùng hết số lượt nộp cho bài tập này.",
      "You have used every attempt for this assignment.",
    ],
    ["NOT_ENROLLED", "Bạn không thuộc lớp của bài tập này.", "You are not enrolled in this class."],
    ["TOO_MANY_FILES", "Bạn đã tải lên quá số tệp cho phép.", "That is more files than this assignment allows."],
    ["FILES_NOT_ACCEPTED", "Bài tập này không nhận tệp đính kèm.", "This assignment does not accept files."],
    ["TEXT_NOT_ACCEPTED", "Bài tập này không nhận phần trả lời bằng chữ.", "This assignment does not accept a written response."],
    [
      "FAILED_SUBMISSION_REQUIRES_NEW_IDEMPOTENCY_KEY",
      "Lần nộp trước đã bị huỷ. Hãy tải lại trang và nộp lại.",
      "That attempt was cancelled. Reload the page and submit again.",
    ],
    [
      "FILE_SET_MISMATCH",
      "Danh sách tệp không khớp với lần nộp đã tạo. Hãy tải lại trang và thử lại.",
      "The files no longer match the reservation. Reload the page and try again.",
    ],
    [
      "FILE_METADATA_MISMATCH",
      "Thông tin tệp không khớp với lần nộp đã tạo. Hãy tải lại trang và thử lại.",
      "The file details no longer match the reservation. Reload the page and try again.",
    ],
    [
      "STORAGE_OBJECT_MIME_MISMATCH",
      "Tệp tải lên không đúng định dạng đã đăng ký. Hãy thử nộp lại.",
      "The uploaded file did not match its recorded type. Please try submitting again.",
    ],
    [
      "STORAGE_OBJECT_SIZE_MISMATCH",
      "Tệp tải lên chưa đầy đủ. Hãy thử nộp lại.",
      "The upload did not finish completely. Please try submitting again.",
    ],
    [
      "STORAGE_OBJECT_NOT_FOUND",
      "Không tìm thấy tệp đã tải lên. Hãy thử nộp lại.",
      "We could not find the uploaded file. Please try submitting again.",
    ],
    [
      "STORAGE_OBJECT_OWNER_MISMATCH",
      "Không thể xác nhận tệp này thuộc về bạn. Hãy thử nộp lại.",
      "We could not verify that this file is yours. Please try submitting again.",
    ],
    [
      "HOMEWORK_RETRY_REQUIRES_SUCCESSFUL_CLEANUP",
      "Chúng tôi đang dọn dẹp lần tải lên trước. Hãy thử lại sau vài phút.",
      "We are still clearing your interrupted upload. Try again in a few minutes.",
    ],
    [
      "HOMEWORK_RETRY_REQUIRES_OBJECT_CLEANUP",
      "Chúng tôi đang dọn dẹp lần tải lên trước. Hãy thử lại sau vài phút.",
      "We are still clearing your interrupted upload. Try again in a few minutes.",
    ],
    [
      "RESERVATION_NOT_RESUMABLE",
      "Không thể tiếp tục lần nộp này. Hãy huỷ và nộp lại từ đầu.",
      "This upload cannot be resumed. Discard it and submit again.",
    ],
    [
      "SUBMISSION_NOT_FAILED",
      "Lần nộp này chưa sẵn sàng để tiếp tục. Hãy tải lại trang.",
      "That attempt is not ready to resume yet. Reload the page.",
    ],
    ["ALREADY_SUBMITTED", "Bài này đã được nộp.", "This attempt has already been submitted."],
    ["SUBMISSION_CANCELLED", "Lần nộp này đã bị huỷ.", "That attempt was cancelled."],
    ["SUBMISSION_FAILED", "Lần nộp này đã thất bại. Hãy nộp lại.", "That attempt failed. Please submit again."],
    ["SUBMISSION_NOT_FOUND", "Không tìm thấy bài nộp.", "Submission not found."],
    ["ASSIGNMENT_NOT_FOUND", "Không tìm thấy bài tập.", "Assignment not found."],
    ["EMPTY_SUBMISSION", "Hãy nhập nội dung hoặc đính kèm ít nhất một tệp.", "Add text or at least one file before submitting."],
    ["INVALID_UPLOAD_PATH", "Đường dẫn tải lên không hợp lệ.", "That upload path is not valid."],
    ["SCORE_ABOVE_MAX", "Điểm không được lớn hơn điểm tối đa.", "Score cannot be greater than max score."],
    ["INVALID_GRADE_STATUS", "Trạng thái chấm bài không hợp lệ.", "That grading status is not valid."],
    ["SUBMISSION_NOT_FINALIZED", "Bài nộp này chưa hoàn tất.", "This submission is not finalized yet."],
    ["FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.", "You do not have permission to do that."],
  ];

  for (const [code, viText, enText] of codes) {
    if (raw.includes(code)) return vi ? viText : enText;
  }

  return vi
    ? "Không thể hoàn tất. Hãy thử lại sau ít phút."
    : "Something went wrong. Please try again in a moment.";
}

function gradeStatusLabel(status: HomeworkGradeStatus, vi: boolean) {
  if (status === "graded") return vi ? "Đã chấm" : "Graded";
  if (status === "returned") return vi ? "Đã trả bài" : "Returned";
  if (status === "resubmit_requested") return vi ? "Yêu cầu nộp lại" : "Resubmit requested";
  return vi ? "Đã nộp" : "Submitted";
}

function statusClasses(status: HomeworkGradeStatus) {
  if (status === "graded") return "border-outline-variant bg-surface-container text-success";
  if (status === "returned" || status === "resubmit_requested") {
    return "border-outline-variant bg-surface-container text-on-surface-variant";
  }
  return "border-outline-variant bg-surface-container-lowest text-on-surface-variant";
}

function SubmissionStatusChip({ status, vi }: { status: HomeworkGradeStatus; vi: boolean }) {
  return (
    <span className={cn("inline-flex rounded-lg border px-2 py-1 text-xs font-bold", statusClasses(status))}>
      {gradeStatusLabel(status, vi)}
    </span>
  );
}

function FilePreview({ file, vi }: { file: HomeworkSubmission["files"][number]; vi: boolean }) {
  const isImage = file.mimeType?.startsWith("image/") && file.signedUrl;
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-on-surface">{file.fileName}</p>
          <p className="text-xs text-on-surface-variant">{formatBytes(file.sizeBytes)}</p>
        </div>
        {file.signedUrl ? (
          <a
            href={file.signedUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant"
            aria-label={vi ? `Mở ${file.fileName}` : `Open ${file.fileName}`}
          >
            <Download className="h-4 w-4" />
          </a>
        ) : null}
      </div>
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={file.signedUrl ?? ""} alt="" className="mt-3 max-h-48 w-full rounded-lg object-contain" />
      ) : null}
    </div>
  );
}

function SubmissionCard({
  submission,
  active,
  onClick,
  locale,
  vi,
}: {
  submission: HomeworkSubmission;
  active?: boolean;
  onClick?: () => void;
  locale: string;
  vi: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border bg-surface-container-lowest p-3 text-left transition-colors",
        active ? "border-primary" : "border-outline-variant",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-on-surface">{submission.studentName}</p>
          <p className="mt-1 text-xs text-on-surface-variant">{formatDateTime(submission.submittedAt, locale)}</p>
        </div>
        <SubmissionStatusChip status={submission.gradeStatus} vi={vi} />
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-on-surface-variant">
        <span>{vi ? `${submission.files.length} tệp` : `${submission.files.length} files`}</span>
        <span>
          {submission.score == null
            ? vi
              ? "Chưa chấm"
              : "Ungraded"
            : `${submission.score}/${submission.scoreMax ?? 100}`}
        </span>
      </div>
    </button>
  );
}

function SubmissionGradeForm({
  clubId,
  submission,
  vi,
}: {
  clubId: string;
  submission: HomeworkSubmission;
  vi: boolean;
}) {
  const router = useRouter();
  const [gradeStatus, setGradeStatus] = useState<"graded" | "returned" | "resubmit_requested">(
    submission.gradeStatus === "returned" || submission.gradeStatus === "resubmit_requested"
      ? submission.gradeStatus
      : "graded",
  );
  const [score, setScore] = useState(submission.score == null ? "" : String(submission.score));
  const [scoreMax, setScoreMax] = useState(submission.scoreMax == null ? "100" : String(submission.scoreMax));
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const [rubric, setRubric] = useState<Record<(typeof RUBRIC_KEYS)[number], string>>({
    clarity: submission.rubricScores.clarity == null ? "" : String(submission.rubricScores.clarity),
    logic: submission.rubricScores.logic == null ? "" : String(submission.rubricScores.logic),
    evidence: submission.rubricScores.evidence == null ? "" : String(submission.rubricScores.evidence),
    delivery: submission.rubricScores.delivery == null ? "" : String(submission.rubricScores.delivery),
  });
  const [isPending, startTransition] = useTransition();

  const rubricLabels: Record<(typeof RUBRIC_KEYS)[number], string> = vi
    ? { clarity: "Rõ ràng", logic: "Lập luận", evidence: "Dẫn chứng", delivery: "Trình bày" }
    : { clarity: "Clarity", logic: "Logic", evidence: "Evidence", delivery: "Delivery" };

  function handleGrade(event: FormEvent) {
    event.preventDefault();
    const numericScore = score.trim() ? Number(score) : null;
    const numericMax = scoreMax.trim() ? Number(scoreMax) : null;
    const rubricScores = Object.fromEntries(
      RUBRIC_KEYS.filter((key) => rubric[key].trim()).map((key) => [key, Number(rubric[key])]),
    );

    startTransition(async () => {
      try {
        await gradeAssignmentSubmission({
          clubId,
          submissionId: submission.id,
          gradeStatus,
          score: numericScore,
          scoreMax: numericMax,
          rubricScores,
          feedback,
        });
        showToast(vi ? "Đã lưu nhận xét." : "Feedback saved.", "success");
        router.refresh();
      } catch (error) {
        showToast(homeworkErrorMessage(error, vi), "error");
      }
    });
  }

  return (
    <form onSubmit={handleGrade} className="rounded-lg border border-outline-variant bg-background p-4">
      <h3 className="text-base font-bold text-on-surface">{vi ? "Nhận xét" : "Feedback"}</h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label={vi ? "Điểm" : "Score"}>
          <input value={score} onChange={(event) => setScore(event.target.value)} inputMode="decimal" className={FIELD_CLASS} />
        </Field>
        <Field label={vi ? "Tối đa" : "Max"}>
          <input value={scoreMax} onChange={(event) => setScoreMax(event.target.value)} inputMode="decimal" className={FIELD_CLASS} />
        </Field>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {RUBRIC_KEYS.map((key) => (
          <Field key={key} label={rubricLabels[key]}>
            <input
              value={rubric[key]}
              onChange={(event) => setRubric((current) => ({ ...current, [key]: event.target.value }))}
              inputMode="decimal"
              className={FIELD_CLASS}
            />
          </Field>
        ))}
      </div>
      <Field label={vi ? "Trạng thái" : "Status"} className="mt-3">
        <select value={gradeStatus} onChange={(event) => setGradeStatus(event.target.value as typeof gradeStatus)} className={FIELD_CLASS}>
          <option value="graded">{vi ? "Đã chấm" : "Graded"}</option>
          <option value="returned">{vi ? "Trả bài" : "Returned"}</option>
          <option value="resubmit_requested">{vi ? "Yêu cầu nộp lại" : "Request resubmit"}</option>
        </select>
      </Field>
      <Field label={vi ? "Ghi chú" : "Comment"} className="mt-3">
        <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={7} className={FIELD_CLASS} />
      </Field>
      <button
        type="submit"
        disabled={isPending}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {vi ? "Lưu nhận xét" : "Save feedback"}
      </button>
    </form>
  );
}

function ManagerWorkspace({
  data,
  locale,
  vi,
}: {
  data: Extract<HomeworkWorkspaceData, { mode: "manager" }>;
  locale: string;
  vi: boolean;
}) {
  const [selectedId, setSelectedId] = useState(data.submissions[0]?.id ?? "");
  const selected = data.submissions.find((submission) => submission.id === selectedId) ?? data.submissions[0] ?? null;
  const gradedCount = data.submissions.filter((submission) => submission.gradeStatus === "graded").length;
  const returnedCount = data.submissions.filter(
    (submission) => submission.gradeStatus === "returned" || submission.gradeStatus === "resubmit_requested",
  ).length;

  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Metric label={vi ? "Đã nộp" : "Submitted"} value={data.submissions.length} />
          <Metric label={vi ? "Đã chấm" : "Graded"} value={gradedCount} />
          <Metric label={vi ? "Đã trả" : "Returned"} value={returnedCount} />
        </div>
        <div className="space-y-2">
          {data.submissions.map((submission) => (
            <SubmissionCard
              key={submission.id}
              submission={submission}
              active={submission.id === selected?.id}
              onClick={() => setSelectedId(submission.id)}
              locale={locale}
              vi={vi}
            />
          ))}
          {data.submissions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-outline-variant px-4 py-12 text-center text-sm text-on-surface-variant">
              {vi ? "Chưa có bài nộp nào." : "No submissions yet."}
            </div>
          ) : null}
        </div>
      </aside>

      {selected ? (
        <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-outline-variant pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-on-surface">{selected.studentName}</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-on-surface-variant">
                <span>{formatDateTime(selected.submittedAt, locale)}</span>
                <SubmissionStatusChip status={selected.gradeStatus} vi={vi} />
              </div>
            </div>
            {selected.score != null ? (
              <div className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-right">
                <p className="text-xs font-bold uppercase text-on-surface-variant">{vi ? "Điểm" : "Score"}</p>
                <p className="text-xl font-black text-on-surface">
                  <AnimatedNumber value={selected.score} />/{selected.scoreMax ?? 100}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <section>
                <h3 className="text-sm font-bold uppercase text-on-surface-variant">{vi ? "Bài làm" : "Response"}</h3>
                <div className="mt-2 rounded-lg border border-outline-variant bg-background p-4 text-sm leading-6 text-on-surface">
                  {selected.submissionText ?? (vi ? "Không có phần trả lời bằng chữ." : "No text response.")}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold uppercase text-on-surface-variant">{vi ? "Tệp đính kèm" : "Files"}</h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {selected.files.map((file) => (
                    <FilePreview key={file.id} file={file} vi={vi} />
                  ))}
                  {selected.files.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-outline-variant px-4 py-10 text-center text-sm text-on-surface-variant">
                      {vi ? "Không có tệp đính kèm." : "No files attached."}
                    </div>
                  ) : null}
                </div>
              </section>
            </div>

            <SubmissionGradeForm
              key={selected.id}
              clubId={data.assignment.clubId}
              submission={selected}
              vi={vi}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

const FIELD_CLASS =
  "min-h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary";

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="text-xs font-bold uppercase text-on-surface-variant">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-center">
      <p className="text-lg font-black text-on-surface">
        <AnimatedNumber value={value} />
      </p>
      <p className="text-xs font-bold text-on-surface-variant">{label}</p>
    </div>
  );
}

/**
 * The interrupted-upload lane. `submitClubAssignment` reserves the attempt
 * before the browser uploads a single byte, so a dropped connection leaves a
 * `draft` / `uploading` / `failed` row that the happy path can never finish.
 * Resuming re-uploads the same files into that same reservation, which is why
 * the learner has to hand the files back: the page reloaded, the File handles
 * are gone.
 */
function PendingSubmissionPanel({
  pending,
  locale,
  vi,
  acceptAttribute,
}: {
  pending: HomeworkPendingSubmission;
  locale: string;
  vi: boolean;
  acceptAttribute: string;
}) {
  const router = useRouter();
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  // A `failed` row has already been cancelled — there is nothing left to
  // discard, and only the cleanup worker can make it resumable again.
  const failed = pending.state === "failed";

  function resumeWith(picked: FileList | null) {
    if (!picked || picked.length === 0) return;
    const chosen = Array.from(picked);
    startTransition(async () => {
      try {
        const result = await retryClubAssignmentSubmission({ submissionId: pending.id });
        // Match by name + size, and consume each pick once: two reservations
        // can legitimately share a file name, and reusing one File for both
        // would upload the same bytes to both paths.
        const unmatched = [...chosen];
        const pairs = result.uploadTargets.map((target) => {
          const index = unmatched.findIndex(
            (file) => file.name === target.fileName && file.size === target.sizeBytes,
          );
          if (index < 0) throw new Error(`RESUME_FILE_MISSING|${target.fileName}`);
          const [file] = unmatched.splice(index, 1);
          return { target, file };
        });

        const supabase = createTypedBrowserClient();
        for (const { target, file } of pairs) {
          const { error } = await supabase.storage
            .from(HOMEWORK_BUCKET)
            .uploadToSignedUrl(target.storagePath, target.token, file, {
              contentType: target.mimeType ?? undefined,
            });
          if (error) throw new Error(error.message);
        }

        await recordAssignmentSubmissionFiles({
          submissionId: result.submissionId,
          files: result.uploadTargets.map((target) => ({
            storagePath: target.storagePath,
            fileName: target.fileName,
            mimeType: target.mimeType,
            sizeBytes: target.sizeBytes,
          })),
        });
        showToast(vi ? "Đã nộp bài." : "Assignment submitted.", "success");
        router.refresh();
      } catch (error) {
        showToast(homeworkErrorMessage(error, vi), "error");
      }
    });
  }

  function discard() {
    startTransition(async () => {
      try {
        await failClubAssignmentSubmission({
          submissionId: pending.id,
          reason: "Discarded by student",
        });
        showToast(vi ? "Đã huỷ lần tải lên dở dang." : "Interrupted upload discarded.", "success");
        router.refresh();
      } catch (error) {
        showToast(homeworkErrorMessage(error, vi), "error");
      }
    });
  }

  return (
    <section className="mb-4 rounded-lg border border-outline-variant bg-surface-container p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest text-on-surface-variant">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-on-surface">
            {failed
              ? vi
                ? "Lần nộp trước không thành công"
                : "Your last upload failed"
              : vi
                ? "Lần tải lên chưa hoàn tất"
                : "Upload never finished"}
          </h3>
          <p className="mt-1 text-sm leading-6 text-on-surface-variant">
            {vi
              ? `Bạn bắt đầu nộp lúc ${formatDateTime(pending.createdAt, locale)} nhưng tệp chưa tải xong. Lần này chưa tính vào số lượt nộp — hãy chọn lại đúng những tệp đó để tiếp tục.`
              : `You started an attempt on ${formatDateTime(pending.createdAt, locale)} but the files never finished uploading. It has not used an attempt — pick the same files again to finish it.`}
          </p>
          {failed && pending.failureReason ? (
            <p className="mt-1 text-xs leading-5 text-on-surface-variant">
              {homeworkErrorMessage(new Error(pending.failureReason), vi)}
            </p>
          ) : null}
          {pending.files.length ? (
            <ul className="mt-3 space-y-1">
              {pending.files.map((file) => (
                <li key={file.storagePath} className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate font-semibold text-on-surface">{file.fileName}</span>
                  <span>{formatBytes(file.sizeBytes)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <input
        ref={resumeInputRef}
        type="file"
        multiple
        accept={acceptAttribute}
        className="hidden"
        onChange={(event) => {
          resumeWith(event.target.files);
          event.target.value = "";
        }}
      />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => resumeInputRef.current?.click()}
          disabled={isPending}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-sm font-bold text-on-surface disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {vi ? "Tiếp tục tải lên" : "Resume upload"}
        </button>
        {failed ? null : (
          <button
            type="button"
            onClick={discard}
            disabled={isPending}
            className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold text-on-surface-variant disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            {vi ? "Huỷ lần này" : "Discard it"}
          </button>
        )}
      </div>
    </section>
  );
}

function StudentWorkspace({
  data,
  locale,
  vi,
}: {
  data: Extract<HomeworkWorkspaceData, { mode: "student" }>;
  locale: string;
  vi: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<Record<number, number>>({});
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const idempotencyKeyRef = useRef<string | null>(null);
  const latestSubmission = data.submissions[0] ?? null;
  // A revision the teacher explicitly asked for outlives the due date; a first
  // attempt does not. This mirrors `reserve_homework_submission`, which resolves
  // the `resubmit_requested` predecessor before it raises ASSIGNMENT_PAST_DUE.
  const revisionRequested = latestSubmission?.gradeStatus === "resubmit_requested";
  const pastDue =
    Boolean(data.assignment.dueAt) &&
    new Date(data.assignment.dueAt as string).getTime() < Date.now();
  const canSubmit =
    data.assignment.status === "active" &&
    (revisionRequested || !pastDue) &&
    (revisionRequested || data.submissions.length < data.assignment.requiredAttempts);

  // Only extensions the storage bucket accepts, intersected with the
  // assignment's own list — the same intersection the server reserves against.
  const allowedExt = useMemo(
    () => normalizeAllowedExtensions(data.assignment.submissionAllowedExt),
    [data.assignment.submissionAllowedExt],
  );
  const acceptAttribute = useMemo(() => homeworkAcceptAttribute(allowedExt), [allowedExt]);
  const maxFiles = data.assignment.submissionMaxFiles;
  const maxFileMb = data.assignment.submissionMaxFileMb;

  /** Reject what the server would reject anyway, and say which file and why. */
  function addFiles(nextFiles: FileList | File[]) {
    const incoming = Array.from(nextFiles);
    const accepted: File[] = [];

    for (const file of incoming) {
      const ext = homeworkFileExtension(file.name);
      if (!ext || !allowedExt.includes(ext) || !canonicalMimeType(file.name)) {
        showToast(
          vi
            ? `"${file.name}" không phải định dạng được chấp nhận (${allowedExt.join(", ")}).`
            : `"${file.name}" is not an accepted file type (${allowedExt.join(", ")}).`,
          "error",
        );
        continue;
      }
      if (file.size > maxFileMb * 1024 * 1024) {
        showToast(
          vi
            ? `"${file.name}" vượt quá ${maxFileMb}MB.`
            : `"${file.name}" is larger than ${maxFileMb}MB.`,
          "error",
        );
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length === 0) return;

    setFiles((current) => {
      const room = Math.max(0, maxFiles - current.length);
      if (room === 0) {
        showToast(
          vi ? `Chỉ được đính kèm tối đa ${maxFiles} tệp.` : `You can attach at most ${maxFiles} files.`,
          "error",
        );
        return current;
      }
      if (accepted.length > room) {
        const dropped = accepted.slice(room).map((file) => file.name).join(", ");
        showToast(
          vi
            ? `Chỉ được đính kèm tối đa ${maxFiles} tệp — chưa thêm: ${dropped}.`
            : `At most ${maxFiles} files — these were not added: ${dropped}.`,
          "error",
        );
      }
      return [...current, ...accepted.slice(0, room)];
    });
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, position) => position !== index));
    setProgress({});
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      let submissionId: string | null = null;
      try {
        setSuccess(false);
        const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
        idempotencyKeyRef.current = idempotencyKey;
        const result = await submitClubAssignment({
          assignmentId: data.assignment.id,
          idempotencyKey,
          submissionText: text,
          files: files.map((file) => ({
            fileName: file.name,
            sizeBytes: file.size,
          })),
        });
        submissionId = result.submissionId;

        const supabase = createTypedBrowserClient();
        for (const [index, target] of result.uploadTargets.entries()) {
          const file = files[index];
          if (!file) throw new Error("FILE_SET_MISMATCH");
          setProgress((current) => ({ ...current, [index]: 35 }));
          // Exactly the MIME the server recorded for this path. The browser's
          // own `file.type` is empty for .m4a and many .docx, which would fail
          // finalize with STORAGE_OBJECT_MIME_MISMATCH after a full upload.
          const { error } = await supabase.storage
            .from(HOMEWORK_BUCKET)
            .uploadToSignedUrl(target.storagePath, target.token, file, {
              contentType: target.mimeType ?? undefined,
            });
          if (error) throw new Error(error.message);
          setProgress((current) => ({ ...current, [index]: 100 }));
        }

        await recordAssignmentSubmissionFiles({
          submissionId: result.submissionId,
          files: result.uploadTargets.map((target) => ({
            storagePath: target.storagePath,
            fileName: target.fileName,
            mimeType: target.mimeType,
            sizeBytes: target.sizeBytes,
          })),
        });

        setText("");
        setFiles([]);
        setProgress({});
        setSuccess(true);
        idempotencyKeyRef.current = null;
        showToast(vi ? "Đã nộp bài." : "Assignment submitted.", "success");
        router.refresh();
      } catch (error) {
        let cleanupSucceeded = !submissionId;
        if (submissionId) {
          try {
            await failClubAssignmentSubmission({
              submissionId,
              reason: error instanceof Error ? error.message : "Upload failed",
            });
            cleanupSucceeded = true;
          } catch {
            // The original upload error is more useful to the learner; the
            // server-side cleanup action is best-effort and retryable.
          }
        }
        if (cleanupSucceeded) idempotencyKeyRef.current = null;
        showToast(homeworkErrorMessage(error, vi), "error");
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={handleSubmit} className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
        {success ? (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container p-3">
            <SuccessCheck size={32} className="text-success" />
            <p className="text-sm font-bold text-on-surface">{vi ? "Đã nộp" : "Submitted"}</p>
          </div>
        ) : null}

        {data.pendingSubmission ? (
          <PendingSubmissionPanel
            pending={data.pendingSubmission}
            locale={locale}
            vi={vi}
            acceptAttribute={acceptAttribute}
          />
        ) : null}

        {data.assignment.submissionTextEnabled ? (
          <Field label={vi ? "Bài làm" : "Response"}>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={10}
              className={FIELD_CLASS}
              disabled={!canSubmit || isPending}
            />
          </Field>
        ) : null}

        {data.assignment.submissionFilesEnabled ? (
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className="mt-4 rounded-lg border border-dashed border-outline-variant bg-background p-5 text-center"
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={acceptAttribute}
              className="hidden"
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <Paperclip className="mx-auto h-8 w-8 text-on-surface-variant" />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={!canSubmit || isPending}
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-sm font-bold text-on-surface disabled:opacity-60"
            >
              <Paperclip className="h-4 w-4" />
              {vi ? "Thêm tệp" : "Add files"}
            </button>
            <p className="mt-3 text-xs text-on-surface-variant">
              {allowedExt.join(", ")} ·{" "}
              {vi ? `tối đa ${maxFiles} tệp` : `${maxFiles} files`} ·{" "}
              {vi ? `${maxFileMb}MB mỗi tệp` : `${maxFileMb}MB each`}
            </p>
          </div>
        ) : null}

        {files.length ? (
          <div className="mt-4 space-y-2">
            {files.map((file, index) => {
              const value = progress[index] ?? 0;
              return (
                <div key={`${file.name}-${file.size}-${index}`} className="rounded-lg border border-outline-variant bg-background p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-bold text-on-surface">{file.name}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-on-surface-variant">{formatBytes(file.size)}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        disabled={isPending}
                        aria-label={vi ? `Bỏ ${file.name}` : `Remove ${file.name}`}
                        className="text-on-surface-variant disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </span>
                  </div>
                  {value > 0 ? (
                    <div className="mt-2 h-2 overflow-hidden rounded-lg bg-surface-container">
                      <div className="h-full bg-primary transition-all" style={{ width: `${value}%` }} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit || isPending || (!text.trim() && files.length === 0)}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {vi ? "Nộp bài" : "Submit"}
        </button>
        {!canSubmit ? (
          <p className="mt-3 text-center text-xs text-on-surface-variant">
            {pastDue
              ? vi
                ? "Bài tập đã quá hạn. Hãy nhờ giáo viên mở lại nếu bạn cần nộp."
                : "This assignment is past due. Ask your teacher to reopen it if you still need to submit."
              : vi
                ? "Bạn đã dùng hết số lượt nộp cho bài tập này."
                : "You have used every attempt for this assignment."}
          </p>
        ) : null}
      </form>

      <aside className="space-y-4">
        <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
          <h2 className="text-base font-bold text-on-surface">{vi ? "Các lần đã nộp" : "Previous submissions"}</h2>
          <div className="mt-3 space-y-3">
            {data.submissions.map((submission) => (
              <div key={submission.id} className="rounded-lg border border-outline-variant bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-on-surface">{formatDateTime(submission.submittedAt, locale)}</p>
                  <SubmissionStatusChip status={submission.gradeStatus} vi={vi} />
                </div>
                {submission.feedback ? <p className="mt-3 text-sm leading-6 text-on-surface">{submission.feedback}</p> : null}
                {submission.score != null ? (
                  <p className="mt-3 text-sm font-bold text-on-surface">
                    {vi ? "Điểm" : "Score"} {submission.score}/{submission.scoreMax ?? 100}
                  </p>
                ) : null}
                <div className="mt-3 space-y-2">
                  {submission.files.map((file) => (
                    <FilePreview key={file.id} file={file} vi={vi} />
                  ))}
                </div>
              </div>
            ))}
            {data.submissions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-outline-variant px-4 py-10 text-center">
                <FileText className="mx-auto h-7 w-7 text-on-surface-variant" />
                <p className="mt-3 text-sm font-bold text-on-surface">
                  {vi ? "Chưa có lần nộp nào" : "Nothing submitted yet"}
                </p>
                <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                  {vi
                    ? "Bài làm và nhận xét của giáo viên sẽ hiện ở đây sau khi bạn nộp."
                    : "Your work and your teacher's feedback will appear here once you submit."}
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </aside>
    </div>
  );
}

export function ClubHomeworkWorkspace({ data, locale }: { data: HomeworkWorkspaceData; locale: string }) {
  const vi = locale === "vi";
  const due = formatDate(data.assignment.dueAt, locale, vi);
  const submittedCount = data.submissions.length;
  // A student's own attempt count is not the class-wide submission count.
  const countChip =
    data.mode === "student"
      ? vi
        ? `Đã dùng ${submittedCount}/${data.assignment.requiredAttempts} lượt nộp`
        : `${submittedCount} of ${data.assignment.requiredAttempts} attempts used`
      : vi
        ? `${submittedCount} bài nộp`
        : `${submittedCount} submissions`;

  return (
    <main className="min-h-full bg-background px-4 py-5 text-on-surface sm:px-5 lg:px-6">
      <div className="mx-auto max-w-7xl">
        <Link
          href={data.mode === "student" ? "/ielts/classes" : `/dashboard/clubs/${data.assignment.clubId}?tab=Assignments`}
          className="inline-flex items-center gap-2 text-sm font-bold text-on-surface-variant"
        >
          <ChevronLeft className="h-4 w-4" />
          {data.mode === "student" ? (vi ? "Lớp của tôi" : "My classes") : vi ? "Bài tập" : "Assignments"}
        </Link>

        <header className="mt-4 border-b border-outline-variant pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-normal text-on-surface sm:text-3xl">{data.assignment.title}</h1>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-on-surface-variant">
                <span className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1">
                  {data.assignment.classTitle ?? (vi ? "Toàn câu lạc bộ" : "Whole club")}
                </span>
                <span className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1">{due}</span>
                <span className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1">
                  {countChip}
                </span>
              </div>
              {data.assignment.description ? (
                <p className="mt-4 max-w-3xl text-sm leading-6 text-on-surface-variant">{data.assignment.description}</p>
              ) : null}
              {data.assignment.submissionInstructions ? (
                <div className="mt-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm leading-6 text-on-surface">
                  {data.assignment.submissionInstructions}
                </div>
              ) : null}
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-success">
              {data.mode === "manager" ? <FileText className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </div>
          </div>
        </header>

        {data.mode === "manager" ? (
          <ManagerWorkspace data={data} locale={locale} vi={vi} />
        ) : (
          <StudentWorkspace data={data} locale={locale} vi={vi} />
        )}
      </div>
    </main>
  );
}
