"use client";

/**
 * Source extraction: adapted from Lumist's
 * features/class-workspace/components/ClassroomGradebook.tsx and
 * ClassroomSubmissionGradeDialog.tsx (local source, inspected 2026-09-05).
 * Thinkfy keeps the row/cell selection and evidence review flow, replacing
 * Lumist styling, hooks, and API calls with the native workbench and the
 * teacher-workspace write seam.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ExternalLink, FileText, RefreshCw, Save } from "@/components/ui/icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  gradeTeacherWorkspaceHomework,
  loadClassGradebook,
  loadClassGradebookEvidence,
} from "@/app/actions/class-lms";
import type {
  ClassGradebookData,
  ClassGradebookEvidence,
} from "@/lib/teacher-workspace/class-gradebook-model";
import { newTeacherWorkspaceIdempotencyKey } from "@/lib/teacher-workspace/write-seam";

interface ClassGradebookProps {
  locale: string;
  classId: string;
  demo?: boolean;
}

type Cell = ClassGradebookData["cells"][string][string];
type SelectedCell = { studentId: string; assessmentId: string };

const DEMO_DATA: ClassGradebookData = {
  students: [
    { id: "demo-anh", name: "Nguyễn Minh Anh" },
    { id: "demo-bao", name: "Trần Gia Bảo" },
    { id: "demo-linh", name: "Lê Khánh Linh" },
  ],
  assessments: [
    { id: "demo-argument", title: "Argument map", maxScore: 10 },
    { id: "demo-rebuttal", title: "Rebuttal practice", maxScore: 20 },
  ],
  cells: {
    "demo-anh": {
      "demo-argument": {
        submissionId: "demo-submission-1",
        status: "graded",
        score: 8,
        scoreMax: 10,
      },
      "demo-rebuttal": {
        submissionId: "demo-submission-2",
        status: "awaiting_review",
        score: null,
        scoreMax: 20,
      },
    },
    "demo-bao": {
      "demo-argument": {
        submissionId: null,
        status: "not_submitted",
        score: null,
        scoreMax: 10,
      },
      "demo-rebuttal": {
        submissionId: null,
        status: "unavailable",
        score: null,
        scoreMax: 20,
      },
    },
    "demo-linh": {
      "demo-argument": {
        submissionId: "demo-submission-3",
        status: "graded",
        score: 10,
        scoreMax: 10,
      },
      "demo-rebuttal": {
        submissionId: "demo-submission-4",
        status: "awaiting_review",
        score: null,
        scoreMax: 20,
      },
    },
  },
};

const copy = (locale: string) =>
  locale === "vi"
    ? {
        title: "Sổ điểm lớp",
        description: "Chọn một bài nộp để xem minh chứng và cập nhật điểm.",
        learner: "Học viên",
        empty: "Chưa có dữ liệu sổ điểm",
        emptyDescription:
          "Học viên và bài đánh giá của lớp sẽ xuất hiện tại đây.",
        loading: "Đang tải sổ điểm…",
        retry: "Thử lại",
        grade: "Xem và chấm bài",
        evidence: "Minh chứng bài nộp",
        response: "Câu trả lời",
        noResponse: "Chưa có nội dung văn bản.",
        files: "Tệp đính kèm",
        openFile: "Mở tệp",
        score: "Điểm",
        feedback: "Nhận xét (không bắt buộc)",
        feedbackPlaceholder: "Viết nhận xét ngắn cho học viên…",
        cancel: "Hủy",
        save: "Lưu điểm",
        saving: "Đang lưu…",
        saved: "Đã lưu điểm.",
        preview: "Bản xem trước — thao tác lưu bị tắt.",
        scoreRequired: "Nhập điểm trước khi lưu.",
        scoreInvalid: "Điểm phải là số hợp lệ trong khoảng cho phép.",
        missing: "Chưa nộp",
        awaiting: "Chờ chấm",
        graded: "Đã chấm",
        unavailable: "Không khả dụng",
        loadError: "Không tải được dữ liệu. Hãy thử lại.",
        evidenceError:
          "Không tải được bài nộp. Điểm đang nhập vẫn được giữ lại.",
        stale:
          "Dữ liệu đã thay đổi. Hãy tải lại rồi thử lại; điểm chưa được lưu.",
        readbackError:
          "Đã lưu điểm nhưng chưa tải lại được sổ điểm. Hãy thử tải lại.",
        reloadEvidence: "Tải lại minh chứng",
        fileUnavailable: "Tệp không khả dụng",
      }
    : {
        title: "Class gradebook",
        description:
          "Select a submission to review evidence and update its score.",
        learner: "Learner",
        empty: "No gradebook data yet",
        emptyDescription:
          "Learners and assessments for this class will appear here.",
        loading: "Loading gradebook…",
        retry: "Try again",
        grade: "Review and grade",
        evidence: "Submission evidence",
        response: "Response",
        noResponse: "No text response was submitted.",
        files: "Attachments",
        openFile: "Open file",
        score: "Score",
        feedback: "Feedback (optional)",
        feedbackPlaceholder: "Write a short note for the learner…",
        cancel: "Cancel",
        save: "Save grade",
        saving: "Saving…",
        saved: "Grade saved.",
        preview: "Preview data — saving is disabled.",
        scoreRequired: "Enter a score before saving.",
        scoreInvalid: "Score must be a valid number within the allowed range.",
        missing: "Not submitted",
        awaiting: "Awaiting review",
        graded: "Graded",
        unavailable: "Unavailable",
        loadError: "Could not load the gradebook. Try again.",
        evidenceError:
          "Could not load the submission. Your draft is preserved.",
        stale:
          "This evidence changed. Reload and try again; the grade was not saved.",
        readbackError:
          "The grade was saved, but the gradebook could not be refreshed. Try again.",
        reloadEvidence: "Reload evidence",
        fileUnavailable: "File unavailable",
      };

function isSuccess<T>(result: {
  ok: boolean;
  data?: T;
}): result is { ok: true; data: T } {
  return result.ok === true;
}

function statusLabel(status: Cell["status"], labels: ReturnType<typeof copy>) {
  return status === "graded"
    ? labels.graded
    : status === "awaiting_review"
      ? labels.awaiting
      : status === "unavailable"
        ? labels.unavailable
        : labels.missing;
}

function fixtureEvidence(
  cell: Cell,
  studentName: string,
  assignmentTitle: string,
  locale: string,
): ClassGradebookEvidence {
  return {
    submissionId: cell.submissionId ?? "demo-submission",
    updatedAt: "2026-09-05T12:00:00.000Z",
    studentName,
    assignmentTitle,
    response:
      locale === "vi"
        ? "Em sẽ làm rõ luận điểm bằng cách nêu lý do mạnh nhất trước, sau đó trả lời phản biện có thể gặp."
        : "I would make the claim clearer by naming the strongest reason first, then answering the likely objection.",
    score: cell.score,
    scoreMax: cell.scoreMax,
    feedback:
      cell.score === null
        ? null
        : locale === "vi"
          ? "Cấu trúc rõ ràng và luận điểm được hỗ trợ tốt."
          : "Clear structure and a well supported point.",
    files: [{ id: "demo-file", name: "argument-notes.pdf", url: null }],
  };
}

function assessmentTitleFor(
  title: string,
  id: string,
  locale: string,
  demo: boolean,
) {
  if (!demo || locale !== "vi") return title;
  return id === "demo-argument" ? "Lập luận" : "Luyện phản biện";
}

export function ClassGradebook({
  locale,
  classId,
  demo = false,
}: ClassGradebookProps) {
  const labels = useMemo(() => copy(locale), [locale]);
  const router = useRouter();
  const [data, setData] = useState<ClassGradebookData | null>(
    demo ? DEMO_DATA : null,
  );
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedCell | null>(null);
  const [evidence, setEvidence] = useState<ClassGradebookEvidence | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const idempotencyRef = useRef<{ payload: string; key: string } | null>(null);
  const evidenceRequestRef = useRef(0);

  const reload = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    setError(null);
    try {
      const result = await loadClassGradebook({ classId, locale });
      if (isSuccess<ClassGradebookData>(result)) setData(result.data);
      else setError(result.message);
    } catch {
      setError(labels.loadError);
    } finally {
      setLoading(false);
    }
  }, [classId, demo, labels.loadError, locale]);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  const openCell = async (
    studentId: string,
    assessmentId: string,
    preserveDraft = false,
  ) => {
    const requestId = evidenceRequestRef.current + 1;
    evidenceRequestRef.current = requestId;
    const cell = data?.cells[studentId]?.[assessmentId];
    if (!cell || cell.status === "unavailable" || !cell.submissionId) return;
    setSelected({ studentId, assessmentId });
    setEvidence(null);
    setEvidenceError(null);
    setSavedMessage(null);
    setSaveError(null);
    setValidationError(null);
    setEvidenceLoading(true);
    const student = data.students.find((item) => item.id === studentId);
    const assessment = data.assessments.find(
      (item) => item.id === assessmentId,
    );
    if (demo) {
      const nextEvidence = fixtureEvidence(
        cell,
        student?.name ?? "",
        assessment
          ? assessmentTitleFor(assessment.title, assessment.id, locale, demo)
          : "",
        locale,
      );
      if (requestId !== evidenceRequestRef.current) return;
      setEvidence(nextEvidence);
      if (!preserveDraft) {
        setScore(nextEvidence.score === null ? "" : String(nextEvidence.score));
        setFeedback(nextEvidence.feedback ?? "");
      }
      setEvidenceLoading(false);
      return;
    }
    try {
      const result = await loadClassGradebookEvidence({
        classId,
        assignmentId: assessmentId,
        submissionId: cell.submissionId,
        locale,
      });
      if (requestId !== evidenceRequestRef.current) return;
      if (isSuccess<ClassGradebookEvidence>(result)) {
        setEvidence(result.data);
        if (!preserveDraft) {
          setScore(result.data.score === null ? "" : String(result.data.score));
          setFeedback(result.data.feedback ?? "");
        }
      } else setEvidenceError(result.message || labels.evidenceError);
    } catch {
      if (requestId === evidenceRequestRef.current)
        setEvidenceError(labels.evidenceError);
    } finally {
      if (requestId === evidenceRequestRef.current) setEvidenceLoading(false);
    }
  };

  const closeSheet = (open: boolean) => {
    if (!open && !savingRef.current) setSelected(null);
  };

  const refreshAfterSave = async () => {
    if (!selected || !evidence) return false;
    try {
      const [freshEvidence, refreshed] = await Promise.all([
        loadClassGradebookEvidence({
          classId,
          assignmentId: selected.assessmentId,
          submissionId: evidence.submissionId,
          locale,
        }),
        loadClassGradebook({ classId, locale }),
      ]);
      if (
        !isSuccess<ClassGradebookEvidence>(freshEvidence) ||
        !isSuccess<ClassGradebookData>(refreshed)
      ) {
        setSaveError(labels.readbackError);
        return false;
      }
      setEvidence(freshEvidence.data);
      setData(refreshed.data);
      setSavedMessage(labels.saved);
      return true;
    } catch {
      setSaveError(labels.readbackError);
      return false;
    }
  };

  const save = async () => {
    if (!evidence || demo || savingRef.current) return;
    const numeric = Number(score);
    if (
      score.trim() === "" ||
      !Number.isFinite(numeric) ||
      numeric < 0 ||
      numeric > evidence.scoreMax
    ) {
      setValidationError(
        score.trim() === "" ? labels.scoreRequired : labels.scoreInvalid,
      );
      return;
    }
    setValidationError(null);
    setSaveError(null);
    setSavedMessage(null);
    const normalizedFeedback = feedback.trim() || null;
    const payload = JSON.stringify([
      evidence.submissionId,
      numeric,
      normalizedFeedback,
      evidence.updatedAt,
    ]);
    if (idempotencyRef.current?.payload !== payload)
      idempotencyRef.current = {
        payload,
        key: newTeacherWorkspaceIdempotencyKey("grade-homework"),
      };
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await gradeTeacherWorkspaceHomework({
        locale,
        submissionId: evidence.submissionId,
        score: numeric,
        scoreMax: evidence.scoreMax,
        feedback: normalizedFeedback,
        expectedUpdatedAt: evidence.updatedAt,
        idempotencyKey: idempotencyRef.current.key,
      });
      if (!isSuccess(result)) {
        setSaveError(
          result.failure === "stale" ? labels.stale : result.message,
        );
        return;
      }
      router.refresh();
      await refreshAfterSave();
      idempotencyRef.current = null;
    } catch {
      setSaveError(
        locale === "vi"
          ? "Mất kết nối. Chưa xác nhận được điểm; hãy thử lưu lại."
          : "Connection lost. The grade could not be confirmed; retry saving.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const retryReadback = async () => {
    if (!evidence || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await refreshAfterSave();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const selectedStudent =
    selected && data?.students.find((item) => item.id === selected.studentId);
  const selectedAssessment =
    selected &&
    data?.assessments.find((item) => item.id === selected.assessmentId);

  if (loading)
    return (
      <div
        className="rounded-control border border-outline-variant bg-surface p-6 type-body text-on-surface-variant"
        role="status"
      >
        {labels.loading}
      </div>
    );
  if (error)
    return (
      <div
        className="rounded-control border border-outline-variant bg-surface p-6"
        role="alert"
      >
        <p className="type-body text-on-surface">{labels.loadError}</p>
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => void reload()}
        >
          <RefreshCw />
          {labels.retry}
        </Button>
      </div>
    );
  if (!data || !data.students.length || !data.assessments.length)
    return (
      <div
        className="rounded-control border border-outline-variant bg-surface p-8 text-center"
        role="status"
      >
        <p className="type-body font-semibold text-on-surface">
          {labels.empty}
        </p>
        <p className="mt-1 type-body-sm text-on-surface-variant">
          {labels.emptyDescription}
        </p>
      </div>
    );

  return (
    <section className="space-y-4" aria-label={labels.title}>
      <header>
        <h2 className="type-heading-md text-on-surface">{labels.title}</h2>
        <p className="mt-1 type-body-sm text-on-surface-variant">
          {labels.description}
        </p>
        {demo ? (
          <p className="mt-2 type-caption text-on-surface-variant">
            {labels.preview}
          </p>
        ) : null}
      </header>
      <div
        className="overflow-auto rounded-control border border-outline-variant bg-surface"
        data-gradebook-scroller
      >
        <table className="min-w-[44rem] border-separate border-spacing-0 text-left">
          <thead>
            <tr className="bg-surface-container-low">
              <th className="sticky left-0 top-0 z-20 min-w-48 border-b border-r border-outline-variant bg-surface-container-low px-3 py-3 type-label text-on-surface">
                {labels.learner}
              </th>
              {data.assessments.map((assessment) => (
                <th
                  key={assessment.id}
                  className="sticky top-0 z-10 min-w-36 border-b border-outline-variant bg-surface-container-low px-3 py-3 type-label text-on-surface"
                >
                  {assessmentTitleFor(
                    assessment.title,
                    assessment.id,
                    locale,
                    demo,
                  )}
                  <span className="block type-caption font-normal text-on-surface-variant">
                    /{assessment.maxScore}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.students.map((student) => (
              <tr key={student.id}>
                <th className="sticky left-0 z-10 border-b border-r border-outline-variant bg-surface px-3 py-3 type-label font-semibold text-on-surface">
                  {student.name}
                </th>
                {data.assessments.map((assessment) => {
                  const cell = data.cells[student.id]?.[assessment.id] ?? {
                    submissionId: null,
                    status: "not_submitted" as const,
                    score: null,
                    scoreMax: assessment.maxScore,
                  };
                  const label =
                    cell.score === null
                      ? statusLabel(cell.status, labels)
                      : `${cell.score}/${cell.scoreMax}`;
                  const title = assessmentTitleFor(
                    assessment.title,
                    assessment.id,
                    locale,
                    demo,
                  );
                  return (
                    <td
                      key={assessment.id}
                      className="border-b border-outline-variant px-3 py-3"
                    >
                      <button
                        type="button"
                        disabled={
                          !cell.submissionId || cell.status === "unavailable"
                        }
                        onClick={() => void openCell(student.id, assessment.id)}
                        aria-label={`${student.name}, ${title}: ${label}`}
                        className="min-h-8 min-w-24 rounded-control border border-outline-variant px-2 type-body-sm font-semibold tabular-nums text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {label}
                        <span className="sr-only">
                          {cell.submissionId ? ` ${labels.grade}` : ""}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Sheet open={Boolean(selected)} onOpenChange={closeSheet}>
        <SheetContent
          side="right"
          className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg bg-surface"
        >
          <SheetHeader>
            <SheetTitle>{labels.evidence}</SheetTitle>
            <SheetDescription>
              {selectedStudent?.name} ·{" "}
              {selectedAssessment
                ? assessmentTitleFor(
                    selectedAssessment.title,
                    selectedAssessment.id,
                    locale,
                    demo,
                  )
                : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4">
            {evidenceLoading ? (
              <div
                className="rounded-control border border-outline-variant p-4 type-body-sm text-on-surface-variant"
                aria-busy="true"
              >
                {labels.loading}
              </div>
            ) : evidenceError ? (
              <div className="space-y-3 rounded-control border border-error-container bg-error-container p-4">
                <p
                  className="type-body-sm text-on-error-container"
                  role="alert"
                >
                  {evidenceError || labels.evidenceError}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    selected &&
                    void openCell(selected.studentId, selected.assessmentId)
                  }
                >
                  {labels.retry}
                </Button>
              </div>
            ) : evidence ? (
              <>
                <section className="space-y-2">
                  <h3 className="type-label text-on-surface">
                    {labels.response}
                  </h3>
                  <div className="max-h-52 overflow-y-auto rounded-control border border-outline-variant bg-surface-container-low p-4 type-body-sm whitespace-pre-wrap text-on-surface">
                    {evidence.response || labels.noResponse}
                  </div>
                </section>
                {evidence.files.length ? (
                  <section className="space-y-2">
                    <h3 className="type-label text-on-surface">
                      {labels.files}
                    </h3>
                    <ul className="space-y-2">
                      {evidence.files.map((file) => (
                        <li
                          key={file.id}
                          className="flex min-w-0 items-center gap-3 rounded-control border border-outline-variant px-3 py-2"
                        >
                          <FileText className="size-5 shrink-0 text-on-surface-variant" />
                          <span className="min-w-0 flex-1 break-words whitespace-normal type-body-sm text-on-surface">
                            {file.name}
                          </span>
                          {file.url ? (
                            <a
                              className={buttonVariants({
                                variant: "outline",
                                size: "icon-sm",
                              })}
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`${labels.openFile}: ${file.name}`}
                            >
                              <ExternalLink />
                            </a>
                          ) : (
                            <span className="type-caption text-on-surface-variant">
                              {labels.fileUnavailable}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {evidence.files.some((file) => !file.url) && selected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void openCell(
                            selected.studentId,
                            selected.assessmentId,
                            true,
                          )
                        }
                      >
                        {labels.reloadEvidence}
                      </Button>
                    ) : null}
                  </section>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
                  <label className="space-y-2 type-label text-on-surface">
                    {labels.score}
                    <div className="flex items-center gap-2">
                      <Input
                        className="rounded-control bg-surface type-body text-on-surface"
                        disabled={saving}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={evidence.scoreMax}
                        step="any"
                        value={score}
                        onChange={(event) => {
                          setScore(event.target.value);
                          setSavedMessage(null);
                        }}
                        aria-invalid={Boolean(validationError)}
                      />
                      <span className="shrink-0 whitespace-nowrap type-body-sm text-on-surface-variant">
                        / {evidence.scoreMax}
                      </span>
                    </div>
                  </label>
                  <label className="space-y-2 type-label text-on-surface">
                    {labels.feedback}
                    <textarea
                      disabled={saving}
                      rows={4}
                      maxLength={5000}
                      value={feedback}
                      onChange={(event) => setFeedback(event.target.value)}
                      placeholder={labels.feedbackPlaceholder}
                      className="w-full resize-y rounded-control border border-outline-variant bg-surface px-3 py-2 type-body-sm text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </label>
                </div>
                {validationError || saveError ? (
                  <div className="space-y-2">
                    <p className="type-body-sm text-error" role="alert">
                      {validationError || saveError}
                    </p>
                    {saveError === labels.stale && selected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void openCell(
                            selected.studentId,
                            selected.assessmentId,
                            true,
                          )
                        }
                      >
                        {labels.reloadEvidence}
                      </Button>
                    ) : null}
                    {saveError === labels.readbackError ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void retryReadback()}
                      >
                        {labels.retry}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {savedMessage ? (
                  <p className="type-body-sm text-success" role="status">
                    {savedMessage}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => closeSheet(false)}
              disabled={saving}
            >
              {labels.cancel}
            </Button>
            <Button
              variant="primary"
              onClick={() => void save()}
              disabled={
                demo ||
                !evidence ||
                evidenceLoading ||
                saving ||
                saveError === labels.readbackError
              }
            >
              <Save />
              {saving ? labels.saving : labels.save}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}
