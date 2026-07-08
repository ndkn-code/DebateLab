"use client";

import { useRef, useState, useTransition, type DragEvent, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  Download,
  FileText,
  Loader2,
  Paperclip,
  Save,
  Send,
} from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import {
  gradeAssignmentSubmission,
  recordAssignmentSubmissionFiles,
  submitClubAssignment,
} from "@/app/actions/club-homework";
import { createTypedBrowserClient } from "@/lib/supabase/client";
import { AnimatedNumber, SuccessCheck } from "@/components/motion";
import { showToast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";
import type { HomeworkGradeStatus, HomeworkSubmission, HomeworkWorkspaceData } from "@/lib/api/club-homework";

const RUBRIC_KEYS = ["clarity", "logic", "evidence", "delivery"] as const;

function formatDate(value: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
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

function statusClasses(status: HomeworkGradeStatus) {
  if (status === "graded") return "border-outline-variant bg-surface-container text-success";
  if (status === "returned" || status === "resubmit_requested") {
    return "border-outline-variant bg-surface-container text-on-surface-variant";
  }
  return "border-outline-variant bg-surface-container-lowest text-on-surface-variant";
}

function SubmissionStatusChip({ status }: { status: HomeworkGradeStatus }) {
  return (
    <span className={cn("inline-flex rounded-lg border px-2 py-1 text-xs font-bold capitalize", statusClasses(status))}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function FilePreview({ file }: { file: HomeworkSubmission["files"][number] }) {
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
            aria-label={`Open ${file.fileName}`}
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
}: {
  submission: HomeworkSubmission;
  active?: boolean;
  onClick?: () => void;
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
          <p className="mt-1 text-xs text-on-surface-variant">{formatDateTime(submission.submittedAt)}</p>
        </div>
        <SubmissionStatusChip status={submission.gradeStatus} />
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-on-surface-variant">
        <span>{submission.files.length} files</span>
        <span>{submission.score == null ? "Ungraded" : `${submission.score}/${submission.scoreMax ?? 100}`}</span>
      </div>
    </button>
  );
}

function SubmissionGradeForm({
  clubId,
  submission,
}: {
  clubId: string;
  submission: HomeworkSubmission;
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
        showToast("Feedback saved.", "success");
        router.refresh();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Unable to save feedback.", "error");
      }
    });
  }

  return (
    <form onSubmit={handleGrade} className="rounded-lg border border-outline-variant bg-background p-4">
      <h3 className="text-base font-bold text-on-surface">Feedback</h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Score">
          <input value={score} onChange={(event) => setScore(event.target.value)} inputMode="decimal" className={FIELD_CLASS} />
        </Field>
        <Field label="Max">
          <input value={scoreMax} onChange={(event) => setScoreMax(event.target.value)} inputMode="decimal" className={FIELD_CLASS} />
        </Field>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {RUBRIC_KEYS.map((key) => (
          <Field key={key} label={key}>
            <input
              value={rubric[key]}
              onChange={(event) => setRubric((current) => ({ ...current, [key]: event.target.value }))}
              inputMode="decimal"
              className={FIELD_CLASS}
            />
          </Field>
        ))}
      </div>
      <Field label="Status" className="mt-3">
        <select value={gradeStatus} onChange={(event) => setGradeStatus(event.target.value as typeof gradeStatus)} className={FIELD_CLASS}>
          <option value="graded">Graded</option>
          <option value="returned">Returned</option>
          <option value="resubmit_requested">Request resubmit</option>
        </select>
      </Field>
      <Field label="Comment" className="mt-3">
        <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={7} className={FIELD_CLASS} />
      </Field>
      <button
        type="submit"
        disabled={isPending}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save feedback
      </button>
    </form>
  );
}

function ManagerWorkspace({ data }: { data: Extract<HomeworkWorkspaceData, { mode: "manager" }> }) {
  const [selectedId, setSelectedId] = useState(data.submissions[0]?.id ?? "");
  const selected = data.submissions.find((submission) => submission.id === selectedId) ?? data.submissions[0] ?? null;
  const gradedCount = data.submissions.filter((submission) => submission.gradeStatus === "graded").length;
  const returnedCount = data.submissions.filter((submission) => submission.gradeStatus === "returned" || submission.gradeStatus === "resubmit_requested").length;

  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Submitted" value={data.submissions.length} />
          <Metric label="Graded" value={gradedCount} />
          <Metric label="Returned" value={returnedCount} />
        </div>
        <div className="space-y-2">
          {data.submissions.map((submission) => (
            <SubmissionCard
              key={submission.id}
              submission={submission}
              active={submission.id === selected?.id}
              onClick={() => setSelectedId(submission.id)}
            />
          ))}
          {data.submissions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-outline-variant px-4 py-12 text-center text-sm text-on-surface-variant">
              No submissions yet.
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
                <span>{formatDateTime(selected.submittedAt)}</span>
                <SubmissionStatusChip status={selected.gradeStatus} />
              </div>
            </div>
            {selected.score != null ? (
              <div className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-right">
                <p className="text-xs font-bold uppercase text-on-surface-variant">Score</p>
                <p className="text-xl font-black text-on-surface">
                  <AnimatedNumber value={selected.score} />/{selected.scoreMax ?? 100}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <section>
                <h3 className="text-sm font-bold uppercase text-on-surface-variant">Response</h3>
                <div className="mt-2 rounded-lg border border-outline-variant bg-background p-4 text-sm leading-6 text-on-surface">
                  {selected.submissionText ?? "No text response."}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold uppercase text-on-surface-variant">Files</h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {selected.files.map((file) => (
                    <FilePreview key={file.id} file={file} />
                  ))}
                  {selected.files.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-outline-variant px-4 py-10 text-center text-sm text-on-surface-variant">
                      No files attached.
                    </div>
                  ) : null}
                </div>
              </section>
            </div>

            <SubmissionGradeForm
              key={selected.id}
              clubId={data.assignment.clubId}
              submission={selected}
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

function StudentWorkspace({ data }: { data: Extract<HomeworkWorkspaceData, { mode: "student" }> }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const latestSubmission = data.submissions[0] ?? null;
  const canSubmit =
    data.assignment.status === "active" &&
    (!data.assignment.dueAt || new Date(data.assignment.dueAt).getTime() >= Date.now()) &&
    (latestSubmission?.gradeStatus === "resubmit_requested" || data.submissions.length < data.assignment.requiredAttempts);

  const allowedExt = data.assignment.submissionAllowedExt?.length
    ? data.assignment.submissionAllowedExt
    : ["pdf", "doc", "docx", "png", "jpg", "jpeg", "mp3", "m4a", "wav"];

  function addFiles(nextFiles: FileList | File[]) {
    const incoming = Array.from(nextFiles);
    setFiles((current) => [...current, ...incoming].slice(0, data.assignment.submissionMaxFiles));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        setSuccess(false);
        const result = await submitClubAssignment({
          assignmentId: data.assignment.id,
          submissionText: text,
          files: files.map((file) => ({
            fileName: file.name,
            mimeType: file.type || null,
            sizeBytes: file.size,
          })),
        });

        const supabase = createTypedBrowserClient();
        for (const [index, target] of result.uploadTargets.entries()) {
          const file = files[index];
          if (!file) continue;
          setProgress((current) => ({ ...current, [target.storagePath]: 35 }));
          const { error } = await supabase.storage
            .from("assignment-submissions")
            .uploadToSignedUrl(target.storagePath, target.token, file, {
              contentType: file.type || undefined,
            });
          if (error) throw new Error(error.message);
          setProgress((current) => ({ ...current, [target.storagePath]: 100 }));
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
        showToast("Assignment submitted.", "success");
        router.refresh();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Unable to submit assignment.", "error");
      }
    });
  }

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={handleSubmit} className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
        {success ? (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container p-3">
            <SuccessCheck size={32} className="text-success" />
            <p className="text-sm font-bold text-on-surface">Submitted</p>
          </div>
        ) : null}

        {data.assignment.submissionTextEnabled ? (
          <Field label="Response">
            <textarea value={text} onChange={(event) => setText(event.target.value)} rows={10} className={FIELD_CLASS} disabled={!canSubmit || isPending} />
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
              className="hidden"
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files);
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
              Add files
            </button>
            <p className="mt-3 text-xs text-on-surface-variant">
              {allowedExt.join(", ")} · {data.assignment.submissionMaxFiles} files · {data.assignment.submissionMaxFileMb}MB each
            </p>
          </div>
        ) : null}

        {files.length ? (
          <div className="mt-4 space-y-2">
            {files.map((file, index) => {
              const key = Object.keys(progress)[index] ?? file.name;
              const value = progress[key] ?? 0;
              return (
                <div key={`${file.name}-${file.size}-${index}`} className="rounded-lg border border-outline-variant bg-background p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-bold text-on-surface">{file.name}</span>
                    <span className="text-xs text-on-surface-variant">{formatBytes(file.size)}</span>
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
          Submit
        </button>
      </form>

      <aside className="space-y-4">
        <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
          <h2 className="text-base font-bold text-on-surface">Previous submissions</h2>
          <div className="mt-3 space-y-3">
            {data.submissions.map((submission) => (
              <div key={submission.id} className="rounded-lg border border-outline-variant bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-on-surface">{formatDateTime(submission.submittedAt)}</p>
                  <SubmissionStatusChip status={submission.gradeStatus} />
                </div>
                {submission.feedback ? <p className="mt-3 text-sm leading-6 text-on-surface">{submission.feedback}</p> : null}
                {submission.score != null ? (
                  <p className="mt-3 text-sm font-bold text-on-surface">
                    Score {submission.score}/{submission.scoreMax ?? 100}
                  </p>
                ) : null}
                <div className="mt-3 space-y-2">
                  {submission.files.map((file) => (
                    <FilePreview key={file.id} file={file} />
                  ))}
                </div>
              </div>
            ))}
            {data.submissions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-outline-variant px-4 py-10 text-center text-sm text-on-surface-variant">
                No submissions yet.
              </p>
            ) : null}
          </div>
        </section>
      </aside>
    </div>
  );
}

export function ClubHomeworkWorkspace({ data }: { data: HomeworkWorkspaceData }) {
  const due = formatDate(data.assignment.dueAt);
  const submittedCount = data.submissions.length;

  return (
    <main className="min-h-full bg-background px-4 py-5 text-on-surface sm:px-5 lg:px-6">
      <div className="mx-auto max-w-7xl">
        <Link
          href={`/dashboard/clubs/${data.assignment.clubId}?tab=Assignments`}
          className="inline-flex items-center gap-2 text-sm font-bold text-on-surface-variant"
        >
          <ChevronLeft className="h-4 w-4" />
          Assignments
        </Link>

        <header className="mt-4 border-b border-outline-variant pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-normal text-on-surface sm:text-3xl">{data.assignment.title}</h1>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-on-surface-variant">
                <span className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1">{data.assignment.classTitle ?? "Whole club"}</span>
                <span className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1">{due}</span>
                <span className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1">
                  {submittedCount} submissions
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

        {data.mode === "manager" ? <ManagerWorkspace data={data} /> : <StudentWorkspace data={data} />}
      </div>
    </main>
  );
}
