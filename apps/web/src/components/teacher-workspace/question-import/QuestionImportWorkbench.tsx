"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileText,
  ImagePlus,
  Import,
  Lock,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Volume2,
  X,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { IELTS_QUESTION_TYPES, IELTS_SKILLS } from "@/lib/api/ielts/schema";
import { cn } from "@/lib/utils";
import {
  createQuestionImportBrowserAdapter,
  type BrowserDraftQuestion,
  type QuestionImportBrowserAdapter,
} from "@/lib/api/class-lms/question-imports/browser-adapter";

type ImportStage = "upload" | "processing" | "review" | "approval";
type ReviewFilter = "all" | "validation" | "media" | "suggestions";

type DraftQuestion = Omit<BrowserDraftQuestion, "payload"> & {
  id: string;
  type: string;
  skill?: string;
  prompt: string;
  answer: string;
  page: number;
  needsMedia?: boolean;
  aiSuggested?: boolean;
  accepted?: boolean;
  rejected?: boolean;
  sourceFileName?: string;
  payload?: Record<string, unknown>;
};

const QUESTION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  IELTS_QUESTION_TYPES.map((type) => [type, type.replaceAll("_", " ")]),
);
const QUESTION_TYPE_LABELS_VI: Record<string, string> = Object.fromEntries(
  IELTS_QUESTION_TYPES.map((type) => [type, type.replaceAll("_", " ")]),
);
Object.assign(QUESTION_TYPE_LABELS_VI, {
  mcq_single: "Trắc nghiệm một đáp án",
  mcq_multi: "Trắc nghiệm nhiều đáp án",
  true_false_notgiven: "Đúng / Sai / Không có thông tin",
  yes_no_notgiven: "Có / Không / Không có thông tin",
  matching_headings: "Ghép tiêu đề",
  matching_information: "Ghép thông tin",
  matching_features: "Ghép đặc điểm",
  matching_sentence_endings: "Ghép phần cuối câu",
  sentence_completion: "Hoàn thành câu",
  summary_completion: "Hoàn thành tóm tắt",
  note_table_form_flowchart_completion: "Hoàn thành ghi chú / bảng / biểu mẫu",
  short_answer: "Trả lời ngắn",
  diagram_label: "Gắn nhãn sơ đồ",
  map_plan_label: "Gắn nhãn bản đồ / mặt bằng",
  writing_task1_academic: "Viết bài 1 (Học thuật)",
  writing_task1_general: "Viết bài 1 (Tổng quát)",
  writing_task2_essay: "Viết bài 2 (Nghị luận)",
  speaking_part1: "Nói phần 1",
  speaking_part2_cuecard: "Nói phần 2 (Thẻ chủ đề)",
  speaking_part3: "Nói phần 3",
});
const SKILL_LABELS = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
} as const;
const SKILL_LABELS_VI = {
  listening: "Nghe",
  reading: "Đọc",
  writing: "Viết",
  speaking: "Nói",
} as const;

export type QuestionImportAdapter = {
  prepare: (input: {
    files: File[];
    audio: File | null;
    rightsAccepted: boolean;
  }) => Promise<void>;
  load?: QuestionImportBrowserAdapter["load"];
  quota?: QuestionImportBrowserAdapter["quota"];
  save?: (question: BrowserDraftQuestion, accepted: boolean) => Promise<void>;
  submit: () => Promise<void>;
  requestChanges?: (note: string) => Promise<void>;
  sourceAction?: (
    action: "quarantined" | "restored" | "deleted",
    reason: string,
  ) => Promise<void>;
  retryDocumentVersion?: (
    materialId: string,
    versionId: string,
  ) => Promise<unknown>;
  permissions?: QuestionImportBrowserAdapter["permissions"];
  recent?: QuestionImportBrowserAdapter["recent"];
  selectBatch?: QuestionImportBrowserAdapter["selectBatch"];
  newBatch?: QuestionImportBrowserAdapter["newBatch"];
  publish: (questionIds: string[]) => Promise<void>;
};

export const QUESTION_IMPORT_LIMITS = {
  maxFiles: 5,
  maxPdfBytes: 25 * 1024 * 1024,
  maxPages: 100,
  maxAudioBytes: 100 * 1024 * 1024,
} as const;

export function validateQuestionImportFiles(files: File[], audio: File | null) {
  const errors: string[] = [];
  if (files.length > QUESTION_IMPORT_LIMITS.maxFiles) errors.push("max-files");
  files.forEach((file) => {
    if (file.type !== "application/pdf") errors.push(`${file.name}:pdf`);
    if (file.size > QUESTION_IMPORT_LIMITS.maxPdfBytes)
      errors.push(`${file.name}:size`);
  });
  if (audio && audio.size > QUESTION_IMPORT_LIMITS.maxAudioBytes)
    errors.push(`${audio.name}:audio-size`);
  if (
    audio &&
    !["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav"].includes(
      audio.type,
    )
  )
    errors.push(`${audio.name}:audio-type`);
  return errors;
}

const COPY = {
  en: {
    title: "Import questions from PDF",
    description: "Turn your documents into a reviewable question bank draft.",
    upload: "Upload",
    processing: "Processing",
    review: "Review",
    approval: "Approval",
    choose: "Choose PDFs",
    drop: "Drop up to 5 PDFs here",
    limits: "PDF only · 25 MB and 100 pages per file",
    audio: "Optional Listening audio",
    audioHelp: "Add audio when the imported test includes Listening.",
    quota: "Quota remaining",
    quotaValue: "342 pages · 812 questions",
    rights:
      "I confirm that I or my organization owns this material or has permission to use and process it, and I accept responsibility for the content uploaded.",
    notice:
      "Avoid uploading unnecessary personal data. Files stay private to your organization.",
    start: "Start import",
    retry: "Retry",
    history: "Recent imports",
    ready: "Ready for review",
    failed: "Needs attention",
    unavailable: "Question import is not available for this organization yet.",
    reviewing: "Review extracted questions",
    source: "Source preview",
    question: "Question",
    answer: "Answer key",
    save: "Accept or reject to save your review",
    suggestion: "AI-suggested answer",
    confirm: "Confirm answer",
    filters: "Filters",
    all: "All",
    validation: "Validation",
    media: "Missing media",
    suggestions: "AI suggestions",
    accept: "Accept",
    reject: "Reject",
    submit: "Submit for approval",
    locked: "Snapshot locked after submission",
    approvalHelp:
      "A lead can publish valid items or return this batch with a reason.",
    publish: "Publish selected",
    return: "Return with reason",
    returnPlaceholder: "What should the teacher fix?",
    noItems: "No questions match this filter.",
    listening: "Listening audio is required before this test can be ready.",
    dirty: "Save and accept every changed question before submitting.",
    unsaved: "Unsaved changes",
    skill: "Skill",
    typeLabel: "Question type",
    options: "Options (JSON)",
    stimulus: "Stimulus (JSON)",
    invalidJson: "Use valid JSON for structured fields.",
  },
  vi: {
    title: "Nhập câu hỏi từ PDF",
    description: "Chuyển tài liệu thành ngân hàng câu hỏi để bạn kiểm tra.",
    upload: "Tải lên",
    processing: "Đang xử lý",
    review: "Kiểm tra",
    approval: "Phê duyệt",
    choose: "Chọn PDF",
    drop: "Thả tối đa 5 PDF vào đây",
    limits: "Chỉ PDF · 25 MB và 100 trang mỗi tệp",
    audio: "Âm thanh Listening (không bắt buộc)",
    audioHelp: "Thêm âm thanh nếu đề có phần Listening.",
    quota: "Hạn mức còn lại",
    quotaValue: "342 trang · 812 câu hỏi",
    rights:
      "Tôi xác nhận tôi hoặc tổ chức của tôi sở hữu tài liệu này hoặc có quyền sử dụng và xử lý tài liệu, và tôi chịu trách nhiệm đối với nội dung tải lên.",
    notice:
      "Tránh tải lên dữ liệu cá nhân không cần thiết. Tệp chỉ được chia sẻ trong tổ chức của bạn.",
    start: "Bắt đầu nhập",
    retry: "Thử lại",
    history: "Lần nhập gần đây",
    ready: "Sẵn sàng kiểm tra",
    failed: "Cần xử lý",
    unavailable: "Tính năng nhập câu hỏi chưa được bật cho tổ chức này.",
    reviewing: "Kiểm tra câu hỏi đã trích xuất",
    source: "Xem trước nguồn",
    question: "Câu hỏi",
    answer: "Đáp án",
    save: "Chấp nhận hoặc từ chối để lưu kiểm tra",
    suggestion: "Đáp án do AI đề xuất",
    confirm: "Xác nhận đáp án",
    filters: "Bộ lọc",
    all: "Tất cả",
    validation: "Kiểm tra lỗi",
    media: "Thiếu nội dung",
    suggestions: "Gợi ý AI",
    accept: "Chấp nhận",
    reject: "Từ chối",
    submit: "Gửi phê duyệt",
    locked: "Bản chụp bị khóa sau khi gửi",
    approvalHelp:
      "Trưởng nhóm có thể xuất bản câu hợp lệ hoặc trả lại kèm lý do.",
    publish: "Xuất bản đã chọn",
    return: "Trả lại kèm lý do",
    returnPlaceholder: "Giáo viên cần sửa gì?",
    noItems: "Không có câu hỏi phù hợp bộ lọc.",
    listening: "Cần âm thanh Listening trước khi đề sẵn sàng.",
    dirty: "Hãy lưu và chấp nhận mọi câu hỏi đã thay đổi trước khi gửi.",
    unsaved: "Thay đổi chưa lưu",
    skill: "Kỹ năng",
    typeLabel: "Loại câu hỏi",
    options: "Lựa chọn (JSON)",
    stimulus: "Ngữ liệu (JSON)",
    invalidJson: "Hãy dùng JSON hợp lệ cho các trường có cấu trúc.",
  },
} as const;

const DEMO_QUESTIONS: DraftQuestion[] = [
  {
    id: "q-1",
    type: "Reading · Multiple choice",
    prompt: "What is the main purpose of the passage?",
    answer: "B",
    page: 3,
    aiSuggested: true,
  },
  {
    id: "q-2",
    type: "Reading · Matching headings",
    prompt: "Choose the heading that best fits paragraph C.",
    answer: "iv",
    page: 4,
    accepted: true,
  },
  {
    id: "q-3",
    type: "Listening · Map labelling",
    prompt: "Label the library entrance on the plan.",
    answer: "",
    page: 7,
    needsMedia: true,
  },
];

function stageNumber(stage: ImportStage) {
  return ["upload", "processing", "review", "approval"].indexOf(stage);
}

function questionTypeLabel(type: string, vi: boolean) {
  return (vi ? QUESTION_TYPE_LABELS_VI : QUESTION_TYPE_LABELS)[type] ?? type;
}

export function QuestionImportWorkbench({
  locale = "en",
  canPublish = false,
  adapter,
  enabled = false,
  demo = false,
  clubId,
  module: initialModule = "academic",
  initialQuestions,
  quota = { pages: 0, questions: 0 },
}: {
  locale?: string;
  canPublish?: boolean;
  adapter?: QuestionImportAdapter;
  enabled?: boolean;
  demo?: boolean;
  clubId?: string;
  module?: "academic" | "general_training";
  initialQuestions?: DraftQuestion[];
  quota?: { pages: number; questions: number };
}) {
  const vi = locale === "vi";
  const [module, setModule] = useState<"academic" | "general_training">(
    initialModule,
  );
  const copy = vi ? COPY.vi : COPY.en;
  const browserAdapter = useMemo(
    () =>
      enabled && clubId && !demo
        ? createQuestionImportBrowserAdapter({
            clubId,
            locale: vi ? "vi" : "en",
            module,
          })
        : undefined,
    [clubId, demo, enabled, module, vi],
  );
  const activeAdapter = adapter ?? browserAdapter;
  const [stage, setStage] = useState<ImportStage>(
    initialQuestions?.length ? "review" : "upload",
  );
  const [files, setFiles] = useState<File[]>([]);
  const [audio, setAudio] = useState<File | null>(null);
  const [rightsAccepted, setRightsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [selectedId, setSelectedId] = useState(
    (initialQuestions ?? (demo ? DEMO_QUESTIONS : []))[0]?.id ?? "",
  );
  const [questions, setQuestions] = useState<DraftQuestion[]>(
    initialQuestions ?? (demo ? DEMO_QUESTIONS : []),
  );
  const [returnReason, setReturnReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(quota);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [structuredText, setStructuredText] = useState<Record<string, string>>(
    {},
  );
  const [lead, setLead] = useState(demo && canPublish);
  const [recent, setRecent] = useState<
    Array<{ id: string; title: string; status: string }>
  >([]);
  const [batchStatus, setBatchStatus] = useState("");
  const [documents, setDocuments] = useState<
    NonNullable<
      Awaited<ReturnType<QuestionImportBrowserAdapter["load"]>>["documents"]
    >
  >([]);
  const [publishIds, setPublishIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (demo || !activeAdapter) return;
    let cancelled = false;
    void activeAdapter
      .permissions?.()
      .then((value) => {
        if (!cancelled) setLead(value.canPublish);
      })
      .catch(() => {
        if (!cancelled) setLead(false);
      });
    void activeAdapter
      .recent?.()
      .then((value) => {
        if (!cancelled) setRecent(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeAdapter, demo]);
  const readSnapshot = async () => {
    const snapshot = await activeAdapter?.load?.();
    if (!snapshot) return;
    setQuestions(snapshot.questions);
    setSelectedId(snapshot.questions[0]?.id ?? "");
    setDocuments(snapshot.documents ?? []);
    setBatchStatus(snapshot.status);
    if (snapshot.module) setModule(snapshot.module);
    setPublishIds(
      new Set(snapshot.questions.filter((q) => q.accepted).map((q) => q.id)),
    );
    setStage(
      ["submitted", "completed", "quarantined", "deleted"].includes(
        snapshot.status,
      )
        ? "approval"
        : ["review", "changes_requested"].includes(snapshot.status)
          ? "review"
          : "processing",
    );
  };

  useEffect(() => {
    if (!activeAdapter?.quota || demo) return;
    void activeAdapter
      .quota()
      .then((value) =>
        setRemaining({
          pages: value.pagesRemaining,
          questions: value.questionsRemaining,
        }),
      )
      .catch(() => setRemaining({ pages: 0, questions: 0 }));
  }, [activeAdapter, demo]);

  useEffect(() => {
    if (stage !== "processing" || !activeAdapter?.load || demo) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const snapshot = await activeAdapter.load?.();
        if (!snapshot || cancelled) return;
        setDocuments(snapshot.documents ?? []);
        setBatchStatus(snapshot.status);
        setPublishIds(
          new Set(
            snapshot.questions.filter((q) => q.accepted).map((q) => q.id),
          ),
        );
        if (snapshot.questions.length) {
          setQuestions(snapshot.questions);
          setSelectedId(
            (current) => current || snapshot.questions[0]?.id || "",
          );
        }
        if (
          ["review", "changes_requested", "submitted", "completed"].includes(
            snapshot.status,
          )
        )
          setStage(snapshot.status === "submitted" ? "approval" : "review");
        if (snapshot.status === "failed")
          setMessage(
            vi
              ? "Không thể xử lý một hoặc nhiều tệp."
              : "One or more files could not be processed.",
          );
      } catch {
        if (!cancelled)
          setMessage(
            vi
              ? "Không thể cập nhật trạng thái nhập."
              : "Could not refresh the import status.",
          );
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeAdapter, demo, stage, vi]);

  const filteredQuestions = useMemo(
    () =>
      questions.filter((question) => {
        if (filter === "validation") return !question.answer;
        if (filter === "media") return question.needsMedia;
        if (filter === "suggestions") return question.aiSuggested;
        return true;
      }),
    [filter, questions],
  );
  const selected =
    questions.find((question) => question.id === selectedId) ??
    filteredQuestions[0] ??
    questions[0];
  const selectedSourceFile = selected?.sourceFileName
    ? files.find((file) => file.name === selected.sourceFileName)
    : files.length === 1 ? files[0] : undefined;

  useEffect(() => {
    if (!selectedSourceFile) {
      setSourceUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedSourceFile);
    setSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedSourceFile]);
  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Array.from(event.target.files ?? []);
    setFiles(next);
    const errors = validateQuestionImportFiles(next, audio);
    setMessage(
      errors.length
        ? vi
          ? "Tệp không hợp lệ. Kiểm tra loại và kích thước tệp."
          : "Invalid file. Check the file type and size limits."
        : null,
    );
  };

  const startImport = async () => {
    if (!files.length || !rightsAccepted || (!activeAdapter && !demo)) return;
    const errors = validateQuestionImportFiles(files, audio);
    if (errors.length) {
      setMessage(
        vi
          ? "Kiểm tra lại giới hạn tệp trước khi tiếp tục."
          : "Check the file limits before continuing.",
      );
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (activeAdapter)
        await activeAdapter.prepare({ files, audio, rightsAccepted });
      setStage("processing");
    } catch {
      setMessage(
        vi
          ? "Không thể bắt đầu nhập. Vui lòng thử lại."
          : "Import could not start. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (
      !!savingId ||
      dirtyIds.size ||
      questions.some(
        (question) =>
          !question.accepted && !question.rejected && !question.published,
      )
    ) {
      setMessage(copy.dirty);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (activeAdapter) await activeAdapter.submit();
      if (activeAdapter) await readSnapshot();
      else {
        setBatchStatus("submitted");
        setPublishIds(
          new Set(
            questions
              .filter((question) => question.accepted)
              .map((question) => question.id),
          ),
        );
        setStage("approval");
      }
    } catch {
      setMessage(
        vi ? "Không thể gửi phê duyệt." : "Could not submit for approval.",
      );
    } finally {
      setBusy(false);
    }
  };

  const updateQuestion = (
    value: string,
    field: "prompt" | "answer" | "type" | "skill" | "options" | "stimulus",
  ) => {
    if (!selected) return;
    setQuestions((current) =>
      current.map((question) =>
        question.id === selected.id
          ? { ...question, [field]: value, accepted: false }
          : question,
      ),
    );
    setDirtyIds((current) => new Set(current).add(selected.id));
  };

  const updateStructured = (
    field: "options" | "stimulus" | "details",
    value: string,
  ) => {
    if (!selected) return;
    setStructuredText((current) => ({
      ...current,
      [`${selected.id}:${field}`]: value,
    }));
    setDirtyIds((current) => new Set(current).add(selected.id));
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      if (
        field === "details" &&
        (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      )
        throw new Error("invalid");
      setQuestions((current) =>
        current.map((question) =>
          question.id === selected.id
            ? {
                ...question,
                payload:
                  field === "details"
                    ? parsed
                    : { ...(question.payload ?? {}), [field]: parsed },
                accepted: false,
              }
            : question,
        ),
      );
      setDirtyIds((current) => new Set(current).add(selected.id));
      setMessage(null);
    } catch {
      setMessage(copy.invalidJson);
    }
  };

  const markAccepted = (accepted: boolean) => {
    if (!selected) return;
    if (savingId) return;
    for (const field of ["options", "stimulus", "details"]) {
      const text = structuredText[`${selected.id}:${field}`];
      if (text !== undefined) {
        try {
          JSON.parse(text);
        } catch {
          setMessage(copy.invalidJson);
          return;
        }
      }
    }
    const edited = {
      ...selected,
      payload: {
        ...(selected.payload ?? {}),
        question_type: selected.type,
        skill:
          selected.skill ??
          (selected.type.startsWith("writing_")
            ? "writing"
            : selected.type.startsWith("speaking_")
              ? "speaking"
              : "reading"),
      },
      accepted,
    };
    setQuestions((current) =>
      current.map((question) =>
        question.id === selected.id
          ? {
              ...question,
              accepted,
              rejected: !accepted,
              aiSuggested: accepted ? false : question.aiSuggested,
            }
          : question,
      ),
    );
    if (!activeAdapter?.save && demo)
      setDirtyIds((current) => {
        const next = new Set(current);
        next.delete(selected.id);
        return next;
      });
    if (activeAdapter?.save) {
      setSavingId(selected.id);
      void activeAdapter
        .save(edited, accepted)
        .then(() =>
          setDirtyIds((current) => {
            const next = new Set(current);
            next.delete(selected.id);
            return next;
          }),
        )
        .catch(() => {
          setQuestions((current) =>
            current.map((question) =>
              question.id === selected.id
                ? {
                    ...question,
                    accepted: selected.accepted,
                    rejected: selected.rejected,
                  }
                : question,
            ),
          );
          setMessage(
            vi ? "Không thể lưu thay đổi." : "Could not save the change.",
          );
        })
        .finally(() => setSavingId(null));
    }
  };

  const publishSelected = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ids = questions
        .filter(
          (question) =>
            question.accepted &&
            !question.needsMedia &&
            publishIds.has(question.id),
        )
        .map((question) => question.id);
      if (!ids.length) throw new Error("NO_PUBLISHABLE_ITEMS");
      await activeAdapter?.publish(ids);
      if (activeAdapter) await readSnapshot();
      else {
        setQuestions((current) => current.map((question) => ids.includes(question.id) ? { ...question, accepted: false, published: true } : question));
        setPublishIds(new Set());
        setBatchStatus("completed");
      }
      setMessage(
        vi
          ? "Đã xuất bản các câu hỏi đã chọn."
          : "Selected questions published.",
      );
    } catch {
      setMessage(
        vi
          ? "Không thể xuất bản. Vui lòng thử lại."
          : "Could not publish. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="mt-5 min-w-0 overflow-hidden rounded-xl border border-outline-variant bg-surface"
      aria-label={copy.title}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-outline-variant bg-surface-container-low px-4 py-4 sm:px-5">
        <div>
          <h2 className="type-heading-md text-on-surface">{copy.title}</h2>
          <p className="mt-1 type-body-sm text-on-surface-variant">
            {copy.description}
          </p>
        </div>
        <div className="text-right type-caption text-on-surface-variant">
          <span className="block font-semibold text-on-surface">
            {copy.quota}
          </span>
          {remaining.pages || remaining.questions
            ? vi
              ? `${remaining.pages} trang · ${remaining.questions} câu hỏi`
              : `${remaining.pages} pages · ${remaining.questions} questions`
            : demo
              ? copy.quotaValue
              : "—"}
        </div>
      </div>

      {message && stage !== "upload" ? (
        <p role="status" className="p-4 type-body-sm text-on-surface">
          {message}
        </p>
      ) : null}
      {!demo && activeAdapter?.recent ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-outline-variant p-4">
          <label className="min-w-0 flex-1 type-label">
            {copy.history}
            <Select
              aria-label={copy.history}
              value=""
              onChange={async (event) => {
                if (!event.target.value) return;
                activeAdapter.selectBatch?.(event.target.value);
                setDirtyIds(new Set());
                setStructuredText({});
                try {
                  await readSnapshot();
                } catch {
                  setMessage(
                    vi
                      ? "Không thể mở lần nhập này."
                      : "Could not open this import.",
                  );
                }
              }}
            >
              <option value="">
                {vi ? "Chọn lần nhập" : "Select an import"}
              </option>
              {recent.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} · {item.status}
                </option>
              ))}
            </Select>
          </label>
          <Button
            variant="outline"
            onClick={() => {
              activeAdapter.newBatch?.();
              setQuestions([]);
              setFiles([]);
              setAudio(null);
              setBatchStatus("");
              setDirtyIds(new Set());
              setStage("upload");
              setMessage(null);
            }}
          >
            {vi ? "Lần nhập mới" : "New import"}
          </Button>
        </div>
      ) : null}
      {documents.some((d) => d.status === "failed") ? (
        <div className="p-4" role="status">
          {documents
            .filter((d) => d.status === "failed")
            .map((d) => (
              <div
                key={d.id}
                className="flex min-w-0 flex-wrap items-center gap-3 py-2 type-body-sm"
              >
                <span className="min-w-0 flex-1 break-words">
                  {d.title}: {d.error}
                </span>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await activeAdapter?.retryDocumentVersion?.(
                        d.materialId,
                        d.versionId,
                      );
                      setStage("processing");
                    } catch {
                      setMessage(
                        vi
                          ? "Không thể thử lại tệp này."
                          : "Could not retry this file.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {copy.retry}
                </Button>
              </div>
            ))}
        </div>
      ) : null}
      {lead && batchStatus ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant p-4">
          <input
            aria-label={vi ? "Lý do xử lý nguồn" : "Source action reason"}
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder={vi ? "Lý do xử lý nguồn" : "Source action reason"}
            className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-2 type-body-sm"
          />
          {(["quarantined", "restored", "deleted"] as const)
            .filter(
              (action) =>
                batchStatus !== "deleted" &&
                (action !== "restored" || batchStatus === "quarantined"),
            )
            .map((action) => (
              <Button
                key={action}
                variant={action === "deleted" ? "destructive" : "outline"}
                disabled={busy || !returnReason.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await activeAdapter?.sourceAction?.(action, returnReason);
                    await readSnapshot();
                    setMessage(
                      vi
                        ? "Đã cập nhật trạng thái nguồn."
                        : "Source status updated.",
                    );
                  } catch {
                    setMessage(
                      vi
                        ? "Không thể cập nhật nguồn."
                        : "Could not update source.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {action === "quarantined"
                  ? vi
                    ? "Cách ly"
                    : "Quarantine"
                  : action === "restored"
                    ? vi
                      ? "Khôi phục"
                      : "Restore"
                    : vi
                      ? "Yêu cầu xóa nguồn"
                      : "Request source deletion"}
              </Button>
            ))}
        </div>
      ) : null}
      <nav
        aria-label={vi ? "Tiến trình nhập" : "Import progress"}
        className="grid grid-cols-4 border-b border-outline-variant"
      >
        {(["upload", "processing", "review", "approval"] as ImportStage[]).map(
          (item, index) => (
            <button
              key={item}
              aria-label={copy[item]}
              type="button"
              aria-current={item === stage ? "step" : undefined}
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 border-b-2 px-2 type-label",
                index <= stageNumber(stage)
                  ? "border-primary text-primary"
                  : "border-transparent text-on-surface-variant",
              )}
              onClick={() => index <= stageNumber(stage) && setStage(item)}
            >
              <span className="grid size-5 place-items-center rounded-full border border-current type-caption">
                {index < stageNumber(stage) ? (
                  <Check className="size-3" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="hidden sm:inline">{copy[item]}</span>
            </button>
          ),
        )}
      </nav>
      {stage === "review" && selected ? (
        <div
          className="grid min-w-0 gap-2 border-b border-outline-variant bg-surface-container-low p-4 sm:grid-cols-2"
          aria-label={copy.typeLabel}
        >
          <label className="type-label text-on-surface">
            {copy.typeLabel}
            <Select
              value={selected.type}
              onChange={(event) => updateQuestion(event.target.value, "type")}
              aria-label={copy.typeLabel}
            >
              {IELTS_QUESTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {(vi ? QUESTION_TYPE_LABELS_VI : QUESTION_TYPE_LABELS)[type]}
                </option>
              ))}
            </Select>
          </label>
          <label className="type-label text-on-surface">
            {copy.skill}
            <Select
              value={String(selected.skill ?? "reading")}
              onChange={(event) => updateQuestion(event.target.value, "skill")}
              aria-label={copy.skill}
            >
              {IELTS_SKILLS.map((skill) => (
                <option key={skill} value={skill}>
                  {(vi ? SKILL_LABELS_VI : SKILL_LABELS)[skill]}
                </option>
              ))}
            </Select>
          </label>
          <details className="min-w-0 sm:col-span-2">
            <summary className="cursor-pointer type-label">
              {vi
                ? "Cấu trúc câu hỏi nâng cao (JSON)"
                : "Advanced question structure (JSON)"}
            </summary>
            <textarea
              aria-label={vi ? "Cấu trúc câu hỏi" : "Question structure"}
              value={
                structuredText[`${selected.id}:details`] ??
                JSON.stringify(selected.payload ?? {}, null, 2)
              }
              onChange={(e) => updateStructured("details", e.target.value)}
              className="min-h-32 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 type-body-sm"
            />
          </details>
          <label className="type-label text-on-surface">
            {copy.options}
            <textarea
              value={
                structuredText[`${selected.id}:options`] ??
                JSON.stringify(selected.payload?.options ?? [], null, 2)
              }
              onChange={(event) =>
                updateStructured("options", event.target.value)
              }
              aria-label={copy.options}
              className="min-h-20 w-full resize-y rounded-lg border border-outline-variant bg-surface px-3 py-2 type-body-sm"
            />
          </label>
          <label className="type-label text-on-surface">
            {copy.stimulus}
            <textarea
              value={
                structuredText[`${selected.id}:stimulus`] ??
                JSON.stringify(selected.payload?.stimulus ?? {}, null, 2)
              }
              onChange={(event) =>
                updateStructured("stimulus", event.target.value)
              }
              aria-label={copy.stimulus}
              className="min-h-20 w-full resize-y rounded-lg border border-outline-variant bg-surface px-3 py-2 type-body-sm"
            />
          </label>
        </div>
      ) : null}

      {stage === "upload" ? (
        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_280px]">
          <div>
            <label className="mb-3 block type-label text-on-surface">
              {vi ? "Mô-đun IELTS" : "IELTS module"}
              <Select
                value={module}
                onChange={(event) =>
                  setModule(event.target.value as typeof module)
                }
                aria-label={vi ? "Mô-đun IELTS" : "IELTS module"}
              >
                <option value="academic">Academic</option>
                <option value="general_training">General Training</option>
              </Select>
            </label>
            <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-4 text-center hover:border-primary">
              <Import className="size-6 text-primary" />
              <span className="mt-2 type-title text-on-surface">
                {copy.drop}
              </span>
              <span className="mt-1 type-caption text-on-surface-variant">
                {copy.limits}
              </span>
              <input
                type="file"
                accept="application/pdf"
                multiple
                onChange={addFiles}
                className="sr-only"
              />
            </label>
            {files.length ? (
              <div className="mt-3 grid gap-1">
                {files.map((file) => (
                  <div
                    key={`${file.name}-${file.size}`}
                    className="flex items-center justify-between gap-2 border-b border-outline-variant py-2 type-body-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2 truncate text-on-surface">
                      <FileText className="size-4 shrink-0 text-primary" />
                      {file.name}
                    </span>
                    <span className="type-caption text-on-surface-variant">
                      {Math.round(file.size / 1024 / 1024)} MB
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border border-outline-variant px-3 py-3">
              <Volume2 className="size-4 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block type-label text-on-surface">
                  {copy.audio}
                </span>
                <span className="block type-caption text-on-surface-variant">
                  {copy.audioHelp}
                </span>
              </span>
              <input
                type="file"
                accept="audio/mpeg,audio/mp4,audio/wav,audio/x-wav"
                onChange={(event) => {
                  const next = event.target.files?.[0] ?? null;
                  setAudio(next);
                  const errors = validateQuestionImportFiles(files, next);
                  setMessage(
                    errors.length
                      ? vi
                        ? "Âm thanh không đúng định dạng hoặc vượt quá 100 MB."
                        : "Audio must be WAV, MP3, or MP4 and stay under 100 MB."
                      : null,
                  );
                }}
                className="sr-only"
              />
              <span className="type-caption text-primary">
                {audio ? audio.name : copy.choose}
              </span>
            </label>
          </div>
          <aside className="grid content-start gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
            <p className="type-caption text-on-surface-variant">
              {copy.notice}
            </p>
            <label className="flex gap-2 type-caption text-on-surface">
              <input
                type="checkbox"
                checked={rightsAccepted}
                onChange={(event) => setRightsAccepted(event.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>{copy.rights}</span>
            </label>
            {!enabled || (!activeAdapter && !demo) ? (
              <p className="type-caption text-warning">{copy.unavailable}</p>
            ) : null}
            <Button
              variant="primary"
              className="mt-2 w-full"
              disabled={
                !enabled ||
                (!activeAdapter && !demo) ||
                !files.length ||
                !rightsAccepted ||
                busy
              }
              onClick={startImport}
            >
              <Import />
              {copy.start}
            </Button>
            {message ? (
              <p role="alert" className="type-caption text-error">
                {message}
              </p>
            ) : null}
          </aside>
        </div>
      ) : null}

      {stage === "processing" ? (
        <div className="grid gap-4 p-4 sm:p-5">
          {files.map((file) => (
            <div
              key={`${file.name}-${file.size}`}
              className="grid min-w-0 gap-2 border-b border-outline-variant pb-4 last:border-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 truncate type-body-sm text-on-surface">
                  <FileText className="size-4 text-primary" />
                  {file.name}
                </span>
                <span className="type-caption text-primary">
                  {vi ? "Đang xử lý" : "Processing"}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
              </div>
              <p className="type-caption text-on-surface-variant">
                {vi
                  ? "Đang xác thực, OCR và trích xuất câu hỏi"
                  : "Validating, running OCR, and extracting questions"}
              </p>
            </div>
          ))}
          {demo ? (
            <Button
              variant="primary"
              className="justify-self-start"
              onClick={() => setStage("review")}
            >
              <CheckCircle2 />
              {copy.ready}
            </Button>
          ) : (
            <p className="type-caption text-on-surface-variant">
              {vi
                ? "Bạn có thể rời trang và quay lại sau."
                : "You can leave this page and return later."}
            </p>
          )}
        </div>
      ) : null}

      {stage === "review" ? (
        <div className="grid min-w-0 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)]">
          <div className="min-w-0 border-b border-outline-variant bg-surface-container-low p-4 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between">
              <h3 className="type-title text-on-surface">{copy.source}</h3>
              <span className="type-caption text-on-surface-variant">
                {vi ? "Trang" : "Page"} {selected?.page ?? 1}
              </span>
            </div>
            {sourceUrl ? (
              <iframe
                src={`${sourceUrl}#page=${selected?.page ?? 1}`}
                title={copy.source}
                className="mt-3 h-96 w-full rounded-lg border border-outline-variant bg-surface"
              />
            ) : (
              <div className="mt-3 grid min-h-64 place-items-center rounded-lg border border-outline-variant bg-surface p-5 text-center">
                <div>
                  <FileText className="mx-auto size-10 text-primary" />
                  <p className="mt-2 type-body-sm text-on-surface-variant">
                    {selectedSourceFile?.name ??
                      (vi
                        ? "Chọn lại PDF gốc để xem trước"
                        : "Reselect the original PDF to preview")}
                  </p>
                  <p className="mt-2 break-words type-caption text-on-surface-variant">{selected?.sourceFileName}</p>
                  <label className="mt-3 inline-flex cursor-pointer type-label text-primary focus-within:outline focus-within:outline-primary">
                    {vi ? "Chọn lại PDF nguồn" : "Reselect source PDF"}
                    <input
                      type="file"
                      accept="application/pdf"
                      className="sr-only"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        if (file.type !== "application/pdf" || (selected?.sourceFileName && file.name !== selected.sourceFileName)) {
                          setMessage(vi ? "Chọn đúng PDF nguồn được ghi ở trên." : "Choose the source PDF named above.");
                          return;
                        }
                        if (selected?.sourceSha256) {
                          const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
                          const actual = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
                          if (actual !== selected.sourceSha256) {
                            setMessage(vi ? "PDF này khác với tệp nguồn đã nhập." : "This PDF differs from the imported source.");
                            return;
                          }
                        }
                        setMessage(null);
                        setFiles((current) => [...current.filter((item) => item.name !== file.name), file]);
                      }}
                    />
                  </label>
                </div>
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 type-caption text-on-surface-variant">
              <ImagePlus className="size-4" />
              {selected?.needsMedia
                ? copy.listening
                : vi
                  ? "Minh chứng được liên kết với trang nguồn"
                  : "Evidence linked to the source page"}
            </div>
          </div>
          <div className="min-w-0 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="type-title text-on-surface">{copy.reviewing}</h3>
                <p className="mt-1 type-caption text-on-surface-variant">
                  {copy.save}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStage("processing")}
              >
                <RefreshCw />
                {copy.history}
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 type-caption text-on-surface-variant">
                {copy.filters}
              </span>
              {(
                ["all", "validation", "media", "suggestions"] as ReviewFilter[]
              ).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={filter === item}
                  onClick={() => setFilter(item)}
                  className={cn(
                    "rounded-md border px-2 py-1 type-caption",
                    filter === item
                      ? "border-primary bg-primary-container text-on-primary-container"
                      : "border-outline-variant text-on-surface-variant",
                  )}
                >
                  {copy[item]}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)]">
              <div className="grid content-start gap-1">
                {filteredQuestions.map((question) => (
                  <button
                    key={question.id}
                    type="button"
                    aria-current={
                      question.id === selected?.id ? "true" : undefined
                    }
                    onClick={() => setSelectedId(question.id)}
                    className={cn(
                      "grid gap-1 border-b border-outline-variant p-3 text-left",
                      question.id === selected?.id
                        ? "bg-primary-container"
                        : "hover:bg-surface-container-low",
                    )}
                  >
                    <span className="type-caption text-on-surface-variant">
                      {questionTypeLabel(question.type, vi)}
                    </span>
                    <span className="line-clamp-2 type-body-sm text-on-surface">
                      {question.prompt}
                    </span>
                    {question.aiSuggested ? (
                      <span className="flex items-center gap-1 type-caption text-warning">
                        <Sparkles className="size-3" />
                        {copy.suggestion}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
              {selected ? (
                <div className="min-w-0">
                  <label className="block type-label text-on-surface">
                    {copy.question}
                    <textarea
                      value={selected.prompt}
                      onChange={(event) =>
                        updateQuestion(event.target.value, "prompt")
                      }
                      className="mt-1 min-h-24 w-full resize-y rounded-lg border border-outline-variant bg-surface px-3 py-2 type-body-sm text-on-surface"
                    />
                  </label>
                  <label className="mt-4 block type-label text-on-surface">
                    {copy.answer}
                    <input
                      value={selected.answer}
                      onChange={(event) =>
                        updateQuestion(event.target.value, "answer")
                      }
                      className="mt-1 h-9 w-full rounded-lg border border-outline-variant bg-surface px-3 type-body-sm text-on-surface"
                    />
                  </label>
                  {selected.aiSuggested ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning bg-warning-container p-3">
                      <span className="flex items-center gap-2 type-label text-on-warning-container">
                        <Sparkles className="size-4" />
                        {copy.suggestion}: {selected.answer || "—"}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markAccepted(true)}
                      >
                        <Check />
                        {copy.confirm}
                      </Button>
                    </div>
                  ) : null}
                  {selected.needsMedia ? (
                    <p className="mt-3 flex gap-2 type-caption text-error">
                      <AlertTriangle className="size-4 shrink-0" />
                      {copy.listening}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markAccepted(true)}
                    >
                      <Check />
                      {copy.accept}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAccepted(false)}
                    >
                      <X />
                      {copy.reject}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="type-body-sm text-on-surface-variant">
                  {copy.noItems}
                </p>
              )}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant pt-4">
              <span className="flex items-center gap-2 type-caption text-on-surface-variant">
                <Save className="size-4" />
                {copy.save}
              </span>
              <Button
                variant="primary"
                disabled={busy || !!savingId || dirtyIds.size > 0}
                onClick={submit}
              >
                <Send />
                {copy.submit}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {stage === "approval" ? (
        <div className="grid gap-5 p-4 sm:p-5">
          <div className="flex items-start gap-3 rounded-lg border border-primary bg-primary-container p-4">
            <Lock className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <h3 className="type-title text-on-primary-container">
                {copy.locked}
              </h3>
              <p className="mt-1 type-body-sm text-on-primary-container">
                {copy.approvalHelp}
              </p>
            </div>
          </div>
          <div className="grid gap-2">
            {questions.map((question) => (
              <div
                key={question.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant py-3"
              >
                {lead && question.accepted && !question.published ? (
                  <input
                    type="checkbox"
                    aria-label={
                      (vi ? "Xuất bản: " : "Publish: ") + question.prompt
                    }
                    checked={publishIds.has(question.id)}
                    onChange={(e) =>
                      setPublishIds((current) => {
                        const next = new Set(current);
                        if (e.target.checked) next.add(question.id);
                        else next.delete(question.id);
                        return next;
                      })
                    }
                    className="size-4 accent-primary"
                  />
                ) : null}
                <div className="min-w-0 flex-1 break-words">
                  <p className="type-label text-on-surface">
                    {questionTypeLabel(question.type, vi)}
                  </p>
                  <p className="type-body-sm text-on-surface-variant">
                    {question.prompt}
                  </p>
                </div>
                <span
                  className={cn(
                    "type-caption",
                    question.needsMedia ||
                      (!question.accepted && !question.published)
                      ? "text-warning"
                      : "text-success",
                  )}
                >
                  {question.published ? (vi ? "Đã xuất bản" : "Published") : question.rejected ? (vi ? "Đã từ chối" : "Rejected") : question.needsMedia || !question.accepted ? copy.failed : copy.ready}
                </span>
              </div>
            ))}
          </div>
          {lead && batchStatus !== "deleted" ? (
            <div className="flex flex-wrap justify-end gap-2">
              <textarea
                value={returnReason}
                onChange={(event) => setReturnReason(event.target.value)}
                placeholder={copy.returnPlaceholder}
                aria-label={copy.returnPlaceholder}
                className="min-h-9 min-w-56 flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-2 type-body-sm"
              />
              <Button
                variant="outline"
                disabled={busy || (!demo && batchStatus !== "submitted")}
                onClick={async () => {
                  if (!returnReason) {
                    setMessage(copy.returnPlaceholder);
                    return;
                  }
                  setBusy(true);
                  try {
                    await activeAdapter?.requestChanges?.(returnReason);
                    await readSnapshot();
                    setMessage(copy.return);
                  } catch {
                    setMessage(
                      vi
                        ? "Không thể trả lại bản nháp."
                        : "Could not return the draft.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <X />
                {copy.return}
              </Button>
              <Button
                variant="primary"
                disabled={busy || (!demo && batchStatus !== "submitted")}
                onClick={publishSelected}
              >
                <CheckCircle2 />
                {copy.publish}
              </Button>
            </div>
          ) : (
            <p className="type-caption text-on-surface-variant">
              {vi
                ? "Chỉ owner, admin hoặc head teacher có thể xuất bản."
                : "Only an owner, admin, or head teacher can publish."}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
