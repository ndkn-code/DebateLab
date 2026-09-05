"use client";

import {
  FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useLocale } from "next-intl";
import {
  assignClassResource,
  assignVocabularySet,
  createClassResource,
  createVocabularySet,
  saveClassAnnouncement,
  saveVocabularyItem,
} from "@/app/actions/class-lms";
import {
  publishTeacherReview,
  retryIeltsScoringWorkflow,
  returnTeacherReview,
  saveTeacherReview,
} from "@/app/actions/ielts/teacher-review";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  GraduationCap,
  Languages,
  Megaphone,
  Plus,
  RotateCcw,
  Save,
  Send,
  Users,
} from "@/components/ui/icons";
import { useRouter } from "@/i18n/navigation";
import type {
  IeltsClassGradebook,
  IeltsGradebookReviewTarget,
} from "@/lib/api/ielts/gradebook-repository";
import type {
  LmsAnnouncement,
  LmsResource,
  LmsVocabularySet,
} from "@/lib/api/class-lms/model";
import { cn } from "@/lib/utils";

export interface IeltsTeacherWorkbenchData {
  enabled: boolean;
  clubId: string | null;
  gradebook: IeltsClassGradebook | null;
  announcements: LmsAnnouncement[];
  resources: LmsResource[];
  vocabulary: LmsVocabularySet[];
  gradebookError: string | null;
  contentError: string | null;
}

export type WorkbenchTab =
  | "overview"
  | "gradebook"
  | "reviews"
  | "assignments"
  | "content"
  | "announcements";

type TeacherBandKey =
  | "taskAchievement"
  | "taskResponse"
  | "coherenceCohesion"
  | "lexicalResource"
  | "grammaticalRangeAccuracy"
  | "fluencyCoherence"
  | "pronunciation";

type ReviewOverride = {
  id: string;
  status: "draft" | "published" | "returned";
  note: string | null;
  bands: Partial<Record<TeacherBandKey, number | null>>;
};

const BAND_OPTIONS = Array.from({ length: 19 }, (_, index) => index / 2);

const copy = {
  en: {
    title: "IELTS teacher workbench",
    gated: "This class is not enabled for the IELTS LMS pilot.",
    gatedBody:
      "Enable the pilot for this organisation or class to open teaching tools.",
    tabs: {
      overview: "Cohort",
      gradebook: "Gradebook",
      reviews: "Review queue",
      assignments: "Assignments",
      content: "Resources",
      announcements: "Announcements",
    },
    metrics: {
      students: "Students",
      review: "Needs review",
      band: "Official average",
      attendance: "Attendance",
    },
    skills: "Skill averages",
    listening: "Listening",
    reading: "Reading",
    writing: "Writing",
    speaking: "Speaking",
    noOfficialBand: "No official band",
    provisional: "Provisional",
    official: "Official",
    source: "Source",
    attendance: "Attendance",
    takeAttendance: "Take attendance",
    progress: "Course progress",
    noProgress: "No course progress yet.",
    student: "Student",
    overall: "Overall",
    emptyGradebook: "No students or assignments are available yet.",
    emptyReviews: "The review queue is clear.",
    emptyAssignments: "No assignments have been added to this class.",
    emptyContent: "No resources have been assigned yet.",
    emptyVocabulary: "No vocabulary sets have been assigned yet.",
    emptyAnnouncements: "No announcements have been posted yet.",
    submitted: "Submitted",
    notSubmitted: "Not submitted",
    due: "Due",
    homework: "Homework",
    attempt: "IELTS attempt",
    reviewDetail: "Review detail",
    response: "Response",
    revision: "Revision",
    writingTask: "Writing Task {number}",
    speakingPart: "Speaking Part {number}",
    draftPrivate: "Drafts are private to you until published.",
    authoritative: "Publishing makes these teacher bands authoritative.",
    publishConfirm: "I confirm these bands are ready to publish.",
    completeBands: "Complete every teacher band before publishing.",
    saveReview: "Save draft",
    reviewSaved: "Private draft saved.",
    publishReview: "Publish review",
    reviewPublished: "Review published as authoritative.",
    returnReview: "Return for resubmission",
    returnHelp: "Returning this response grants one resubmission.",
    reviewerNote: "Teacher note",
    returnNote: "Instructions for the learner",
    returnConfirm: "I confirm this learner should receive one resubmission.",
    reviewReturned: "Review returned with one resubmission.",
    scoringStatus: "AI scoring",
    scoringStatusLabels: {
      pending: "Waiting",
      scoring: "Scoring",
      scored: "Scored",
      failed: "Needs attention",
      overridden: "Teacher confirmed",
    },
    scoringFailed:
      "Automated scoring stopped after its safe retry limit. You can request one bounded retry.",
    retryScoring: "Retry AI scoring",
    scoringRetryQueued: "Scoring retry queued.",
    awaitingResubmission: "Returned. Waiting for the learner’s new revision.",
    selectBand: "Not set",
    statusLabels: {
      none: "Unreviewed",
      draft: "Private draft",
      published: "Published",
      returned: "Returned",
    },
    criterion: "Criterion",
    ai: "AI",
    teacher: "Teacher",
    effective: "Effective",
    noRationale: "No criterion note",
    addLink: "Add resource link",
    addVocabulary: "Add vocabulary set",
    newAnnouncement: "New announcement",
    titleField: "Title",
    description: "Description",
    url: "URL",
    provenance: "Source / provenance",
    term: "First term",
    definition: "Definition",
    translation: "Vietnamese translation",
    body: "Message",
    draft: "Draft",
    published: "Published",
    publish: "Publish",
    saveDraft: "Save draft",
    add: "Add",
    saving: "Saving…",
    saved: "Saved.",
    retry: "Try again",
    items: "items",
    open: "Open",
    loadIssue: "Some workbench data could not be loaded.",
    status: "Status",
  },
  vi: {
    title: "Bàn làm việc giáo viên IELTS",
    gated: "Lớp này chưa được bật cho chương trình thử nghiệm IELTS LMS.",
    gatedBody:
      "Bật chương trình cho tổ chức hoặc lớp để sử dụng công cụ giảng dạy.",
    tabs: {
      overview: "Lớp học",
      gradebook: "Sổ điểm",
      reviews: "Hàng chờ duyệt",
      assignments: "Bài tập",
      content: "Tài nguyên",
      announcements: "Thông báo",
    },
    metrics: {
      students: "Học viên",
      review: "Cần duyệt",
      band: "Điểm chính thức TB",
      attendance: "Điểm danh",
    },
    skills: "Điểm kỹ năng trung bình",
    listening: "Nghe",
    reading: "Đọc",
    writing: "Viết",
    speaking: "Nói",
    noOfficialBand: "Chưa có điểm chính thức",
    provisional: "Tạm tính",
    official: "Chính thức",
    source: "Nguồn",
    attendance: "Điểm danh",
    takeAttendance: "Điểm danh",
    progress: "Tiến độ khóa học",
    noProgress: "Chưa có tiến độ khóa học.",
    student: "Học viên",
    overall: "Tổng",
    emptyGradebook: "Chưa có học viên hoặc bài tập.",
    emptyReviews: "Không có bài nào đang chờ duyệt.",
    emptyAssignments: "Lớp này chưa có bài tập.",
    emptyContent: "Chưa có tài nguyên được giao.",
    emptyVocabulary: "Chưa có bộ từ vựng được giao.",
    emptyAnnouncements: "Chưa có thông báo.",
    submitted: "Đã nộp",
    notSubmitted: "Chưa nộp",
    due: "Hạn",
    homework: "Bài tập về nhà",
    attempt: "Lần thi IELTS",
    reviewDetail: "Chi tiết bài duyệt",
    response: "Bài trả lời",
    revision: "Phiên bản",
    writingTask: "Writing Task {number}",
    speakingPart: "Speaking Part {number}",
    draftPrivate: "Bản nháp chỉ mình bạn thấy cho đến khi được đăng.",
    authoritative: "Khi đăng, điểm của giáo viên sẽ trở thành điểm chính thức.",
    publishConfirm: "Tôi xác nhận các điểm này đã sẵn sàng để đăng.",
    completeBands: "Điền đủ mọi tiêu chí trước khi đăng.",
    saveReview: "Lưu nháp",
    reviewSaved: "Đã lưu bản nháp riêng tư.",
    publishReview: "Đăng bài duyệt",
    reviewPublished: "Đã đăng điểm giáo viên làm điểm chính thức.",
    returnReview: "Trả bài để nộp lại",
    returnHelp: "Trả bài sẽ cấp cho học viên một lần nộp lại.",
    reviewerNote: "Ghi chú của giáo viên",
    returnNote: "Hướng dẫn cho học viên",
    returnConfirm: "Tôi xác nhận học viên này được nộp lại một lần.",
    reviewReturned: "Đã trả bài và cấp một lần nộp lại.",
    scoringStatus: "Chấm điểm AI",
    scoringStatusLabels: {
      pending: "Đang chờ",
      scoring: "Đang chấm",
      scored: "Đã chấm",
      failed: "Cần xử lý",
      overridden: "Giáo viên xác nhận",
    },
    scoringFailed:
      "Chấm điểm tự động đã dừng sau giới hạn thử lại an toàn. Bạn có thể yêu cầu thử lại một lần.",
    retryScoring: "Thử chấm điểm lại",
    scoringRetryQueued: "Đã xếp hàng chấm điểm lại.",
    awaitingResubmission: "Đã trả bài. Đang chờ phiên bản mới từ học viên.",
    selectBand: "Chưa đặt",
    statusLabels: {
      none: "Chưa duyệt",
      draft: "Bản nháp riêng tư",
      published: "Đã đăng",
      returned: "Đã trả bài",
    },
    criterion: "Tiêu chí",
    ai: "AI",
    teacher: "Giáo viên",
    effective: "Điểm dùng",
    noRationale: "Chưa có ghi chú tiêu chí",
    addLink: "Thêm liên kết tài nguyên",
    addVocabulary: "Thêm bộ từ vựng",
    newAnnouncement: "Thông báo mới",
    titleField: "Tiêu đề",
    description: "Mô tả",
    url: "URL",
    provenance: "Nguồn / xuất xứ",
    term: "Từ đầu tiên",
    definition: "Định nghĩa",
    translation: "Bản dịch tiếng Việt",
    body: "Nội dung",
    draft: "Bản nháp",
    published: "Đã đăng",
    publish: "Đăng",
    saveDraft: "Lưu nháp",
    add: "Thêm",
    saving: "Đang lưu…",
    saved: "Đã lưu.",
    retry: "Thử lại",
    items: "mục",
    open: "Mở",
    loadIssue: "Không thể tải một phần dữ liệu bàn làm việc.",
    status: "Trạng thái",
  },
} as const;

function formatBand(value: number | null) {
  return value == null ? "—" : value.toFixed(1);
}

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function reviewBandKeys(target: IeltsGradebookReviewTarget): TeacherBandKey[] {
  if (target.responseKind === "speaking") {
    return [
      "fluencyCoherence",
      "lexicalResource",
      "grammaticalRangeAccuracy",
      "pronunciation",
    ];
  }
  return [
    target.taskNumber === 1 ? "taskAchievement" : "taskResponse",
    "coherenceCohesion",
    "lexicalResource",
    "grammaticalRangeAccuracy",
  ];
}

function reviewTargetLabel(
  target: IeltsGradebookReviewTarget,
  t: typeof copy.en | typeof copy.vi,
) {
  const template =
    target.responseKind === "writing" ? t.writingTask : t.speakingPart;
  return template.replace(
    "{number}",
    String(
      target.responseKind === "writing"
        ? (target.taskNumber ?? "—")
        : (target.partNumber ?? "—"),
    ),
  );
}

function bandFromForm(values: FormData, key: TeacherBandKey) {
  const raw = values.get(key);
  if (typeof raw !== "string" || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function bandsFromForm(target: IeltsGradebookReviewTarget, values: FormData) {
  if (target.responseKind === "speaking") {
    return {
      fluencyCoherence: bandFromForm(values, "fluencyCoherence"),
      lexicalResource: bandFromForm(values, "lexicalResource"),
      grammaticalRangeAccuracy: bandFromForm(
        values,
        "grammaticalRangeAccuracy",
      ),
      pronunciation: bandFromForm(values, "pronunciation"),
    };
  }
  const common = {
    coherenceCohesion: bandFromForm(values, "coherenceCohesion"),
    lexicalResource: bandFromForm(values, "lexicalResource"),
    grammaticalRangeAccuracy: bandFromForm(values, "grammaticalRangeAccuracy"),
  };
  return target.taskNumber === 1
    ? {
        taskAchievement: bandFromForm(values, "taskAchievement"),
        ...common,
      }
    : {
        taskResponse: bandFromForm(values, "taskResponse"),
        ...common,
      };
}

function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "error";
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-md border px-1.5 type-caption font-semibold",
        tone === "success" &&
          "border-success/20 bg-success-container text-success-dim",
        tone === "warning" &&
          "border-warning/20 bg-warning-container text-on-warning-container",
        tone === "error" && "border-error/20 bg-error-container text-error-dim",
        tone === "neutral" &&
          "border-outline-variant bg-surface-container text-on-surface-variant",
      )}
    >
      {children}
    </span>
  );
}

function EmptyState({
  icon: Icon,
  children,
}: {
  icon: typeof ClipboardList;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-control border border-dashed border-outline-variant bg-surface-container/40 px-4 text-center">
      <Icon className="mb-2 h-5 w-5 text-on-surface-variant" />
      <p className="type-body-sm text-on-surface-variant">{children}</p>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-control border border-outline-variant bg-surface px-3 py-3">
      <div className="flex items-center gap-2 type-label font-medium text-on-surface-variant">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-container">
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <strong className="type-title font-medium text-on-surface">
          {value}
        </strong>
        {detail ? (
          <span className="type-caption text-on-surface-variant">{detail}</span>
        ) : null}
      </div>
    </div>
  );
}

export function IeltsTeacherWorkbench({
  classId,
  data,
  onTakeAttendance,
  initialTab = "overview",
  initialResponseId = null,
}: {
  classId: string;
  data: IeltsTeacherWorkbenchData;
  onTakeAttendance: () => void;
  initialTab?: WorkbenchTab;
  initialResponseId?: string | null;
}) {
  const locale = useLocale();
  const t = locale === "vi" ? copy.vi : copy.en;
  const router = useRouter();
  const [tab, setTab] = useState<WorkbenchTab>(initialTab);
  const [selectedReviewKey, setSelectedReviewKey] = useState<string | null>(
    null,
  );
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [reviewOverrides, setReviewOverrides] = useState<
    Partial<Record<string, ReviewOverride>>
  >({});
  const [isPending, startTransition] = useTransition();
  const detailRef = useRef<HTMLDivElement>(null);
  const retryIdempotencyKeys = useRef(new Map<string, string>());

  const assignments = useMemo(() => {
    const values = data.gradebook?.rows.flatMap((row) => row.assignments) ?? [];
    return [
      ...new Map(
        values.map((assignment) => [assignment.assignmentId, assignment]),
      ).values(),
    ];
  }, [data.gradebook]);

  const reviewQueue = useMemo(
    () =>
      (data.gradebook?.rows ?? []).flatMap((row) =>
        row.assignments.flatMap((assignment) =>
          assignment.reviewTargets.map((target) => ({
            key: `${row.userId}:${assignment.assignmentId}:${target.responseId}:${target.revision}`,
            student: row,
            assignment,
            target,
          })),
        ),
      ),
    [data.gradebook],
  );

  useEffect(() => {
    if (!initialResponseId || selectedReviewKey) return;
    const initialReview = reviewQueue.find(
      (item) => item.target.responseId === initialResponseId,
    );
    if (!initialReview) return;
    // Apply the URL deep link once its authorized review queue has loaded. The selected-key guard prevents repeated updates.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab("reviews");
    setSelectedReviewKey(initialReview.key);
  }, [initialResponseId, reviewQueue, selectedReviewKey]);
  const selectedReview =
    reviewQueue.find((item) => item.key === selectedReviewKey) ??
    reviewQueue[0] ??
    null;
  const selectedOverride = selectedReview
    ? reviewOverrides[selectedReview.key]
    : undefined;
  const selectedReviewStatus =
    selectedOverride?.status ??
    selectedReview?.target.currentReviewStatus ??
    "none";
  const selectedReviewId =
    selectedOverride?.id ?? selectedReview?.target.currentReviewId ?? null;
  const selectedBandKeys = selectedReview
    ? reviewBandKeys(selectedReview.target)
    : [];
  const selectedBandsComplete = selectedReview
    ? selectedBandKeys.every((key) => {
        const overrideValue = selectedOverride?.bands[key];
        if (overrideValue != null) return true;
        return (
          selectedReview.target.criteria.find(
            (criterion) => criterion.key === key,
          )?.teacherBand != null
        );
      })
    : false;
  const openReviewCount = reviewQueue.filter((item) => {
    const status =
      reviewOverrides[item.key]?.status ?? item.target.currentReviewStatus;
    return status === "none" || status === "draft";
  }).length;

  useEffect(() => {
    if (selectedReviewKey) detailRef.current?.focus();
  }, [selectedReviewKey]);

  const tabs: WorkbenchTab[] = [
    "overview",
    "gradebook",
    "reviews",
    "assignments",
    "content",
    "announcements",
  ];

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    current: WorkbenchTab,
  ) {
    const index = tabs.indexOf(current);
    const nextIndex =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : null;
    if (nextIndex == null) return;
    event.preventDefault();
    const next = tabs[nextIndex];
    setTab(next);
    requestAnimationFrame(() =>
      document.getElementById(`ielts-tab-${next}`)?.focus(),
    );
  }

  function submit(action: () => Promise<unknown>, form?: HTMLFormElement) {
    setFeedback(null);
    startTransition(async () => {
      try {
        await action();
        form?.reset();
        setFeedback({ tone: "success", text: t.saved });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          text: error instanceof Error ? error.message : t.retry,
        });
      }
    });
  }

  function runReviewAction(
    action: () => Promise<void>,
    successMessage: string,
  ) {
    setFeedback(null);
    startTransition(async () => {
      try {
        await action();
        setFeedback({ tone: "success", text: successMessage });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          text: error instanceof Error ? error.message : t.retry,
        });
      }
    });
  }

  function handleSaveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedReview || !data.clubId) return;
    const values = new FormData(event.currentTarget);
    const bands = bandsFromForm(selectedReview.target, values);
    const target = selectedReview.target;
    const key = selectedReview.key;
    runReviewAction(async () => {
      const result = await saveTeacherReview({
        clubId: data.clubId,
        classId,
        attemptId: target.attemptId,
        assignmentId: target.assignmentId,
        expectedRevision: target.revision,
        ...(target.responseKind === "writing"
          ? { writingResponseId: target.responseId }
          : { speakingResponseId: target.responseId }),
        bands,
        reviewerNote: String(values.get("reviewerNote") ?? "") || null,
      });
      setReviewOverrides((current) => ({
        ...current,
        [key]: {
          id: result.review.id,
          status: "draft",
          note: result.review.reviewer_note,
          bands,
        },
      }));
    }, t.reviewSaved);
  }

  function handlePublishReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !selectedReview ||
      !data.clubId ||
      !selectedReviewId ||
      !selectedBandsComplete
    )
      return;
    const key = selectedReview.key;
    const reviewId = selectedReviewId;
    runReviewAction(async () => {
      await publishTeacherReview({ clubId: data.clubId, classId, reviewId });
      setReviewOverrides((current) => ({
        ...current,
        [key]: {
          id: reviewId,
          status: "published",
          note:
            current[key]?.note ??
            selectedReview.target.currentReviewNote ??
            null,
          bands: current[key]?.bands ?? {},
        },
      }));
    }, t.reviewPublished);
  }

  function handleReturnReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedReview || !data.clubId || !selectedReviewId) return;
    const values = new FormData(event.currentTarget);
    const note = String(values.get("returnNote") ?? "").trim();
    const key = selectedReview.key;
    const reviewId = selectedReviewId;
    runReviewAction(async () => {
      await returnTeacherReview({
        clubId: data.clubId,
        classId,
        reviewId,
        note,
      });
      setReviewOverrides((current) => ({
        ...current,
        [key]: {
          id: reviewId,
          status: "returned",
          note,
          bands: current[key]?.bands ?? {},
        },
      }));
    }, t.reviewReturned);
  }

  function handleRetryScoring() {
    if (!selectedReview || !data.clubId) return;
    const target = selectedReview.target;
    const retryKey = `${target.responseId}:${target.revision}`;
    const idempotencyKey =
      retryIdempotencyKeys.current.get(retryKey) ?? crypto.randomUUID();
    retryIdempotencyKeys.current.set(retryKey, idempotencyKey);
    runReviewAction(async () => {
      await retryIeltsScoringWorkflow({
        clubId: data.clubId,
        classId,
        attemptId: target.attemptId,
        responseId: target.responseId,
        responseKind: target.responseKind,
        expectedRevision: target.revision,
        idempotencyKey,
      });
    }, t.scoringRetryQueued);
  }

  function handleAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    submit(
      () =>
        saveClassAnnouncement({
          classId,
          title: String(values.get("title") ?? ""),
          body: String(values.get("body") ?? ""),
          status: values.get("status") === "published" ? "published" : "draft",
          publishAt: null,
        }),
      form,
    );
  }

  function handleResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.clubId) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    submit(async () => {
      const resource = await createClassResource({
        clubId: data.clubId,
        scopeClassId: classId,
        title: String(values.get("title") ?? ""),
        description: String(values.get("description") ?? "") || null,
        kind: "link",
        url: String(values.get("url") ?? ""),
        storagePath: null,
        provenance: String(values.get("provenance") ?? "") || null,
        licenseStatus: "pending",
        status: "draft",
        metadata: {},
      });
      await assignClassResource({
        resourceId: resource.id,
        classId,
        courseId: null,
      });
    }, form);
  }

  function handleVocabulary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.clubId) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    submit(async () => {
      const set = await createVocabularySet({
        clubId: data.clubId,
        scopeClassId: classId,
        title: String(values.get("title") ?? ""),
        description: String(values.get("description") ?? "") || null,
        provenance: null,
        licenseStatus: "pending",
        status: "draft",
        metadata: {},
      });
      await assignVocabularySet({ setId: set.id, classId, courseId: null });
      const term = String(values.get("term") ?? "").trim();
      const definition = String(values.get("definition") ?? "").trim();
      if (term && definition) {
        await saveVocabularyItem({
          setId: set.id,
          term,
          definition,
          translation: String(values.get("translation") ?? "") || null,
          example: null,
          orderIndex: 0,
          metadata: {},
        });
      }
    }, form);
  }

  if (!data.enabled) {
    return (
      <div className="mt-5 rounded-[12px] border border-outline-variant bg-surface p-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-control bg-surface-container">
          <GraduationCap className="h-5 w-5 text-on-surface-variant" />
        </div>
        <h2 className="mt-4 type-body font-medium text-on-surface">
          {t.gated}
        </h2>
        <p className="mt-1 max-w-xl type-body-sm text-on-surface-variant">
          {t.gatedBody}
        </p>
      </div>
    );
  }

  const summary = data.gradebook?.summary;
  const attendanceRates =
    data.gradebook?.rows
      .map((row) => row.attendance.rate)
      .filter((value): value is number => value != null) ?? [];
  const attendanceAverage = attendanceRates.length
    ? Math.round(
        (attendanceRates.reduce((sum, value) => sum + value, 0) /
          attendanceRates.length) *
          100,
      )
    : null;

  return (
    <section className="mt-5" aria-labelledby="ielts-workbench-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="ielts-workbench-title"
            className="type-body font-medium text-on-surface"
          >
            {t.title}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusBadge tone="success">IELTS</StatusBadge>
            <StatusBadge>
              {data.gradebook?.rubric.version ?? "Rubric"}
            </StatusBadge>
          </div>
        </div>
        <button
          type="button"
          onClick={onTakeAttendance}
          className="inline-flex h-8 items-center justify-center gap-2 rounded-control bg-primary px-3 type-label font-medium text-on-primary transition-colors duration-150 hover:bg-primary-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
        >
          <CalendarDays className="h-4 w-4" />
          {t.takeAttendance}
        </button>
      </div>

      {(data.gradebookError || data.contentError) && (
        <div
          role="alert"
          className="mt-4 flex gap-2 rounded-control border border-warning/25 bg-warning-container px-3 py-2.5 type-body-sm text-on-warning-container"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{t.loadIssue}</p>
            <p className="mt-0.5 type-caption opacity-80">
              {data.gradebookError ?? data.contentError}
            </p>
          </div>
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className={cn(
            "mt-4 rounded-control border px-3 py-2 type-body-sm",
            feedback.tone === "success"
              ? "border-success/20 bg-success-container text-success-dim"
              : "border-error/20 bg-error-container text-error-dim",
          )}
        >
          {feedback.text}
        </div>
      )}

      <div
        className="mt-4 overflow-x-auto rounded-control border border-outline-variant bg-surface-container-low p-1"
        role="tablist"
        aria-label={t.title}
      >
        <div className="flex min-w-max gap-1">
          {tabs.map((item) => (
            <button
              key={item}
              id={`ielts-tab-${item}`}
              type="button"
              role="tab"
              aria-selected={tab === item}
              aria-controls={`ielts-panel-${item}`}
              tabIndex={tab === item ? 0 : -1}
              onClick={() => setTab(item)}
              onKeyDown={(event) => handleTabKeyDown(event, item)}
              className={cn(
                "h-8 rounded-lg border px-3 type-label font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                tab === item
                  ? "border-outline-variant bg-surface text-on-surface shadow-token-card"
                  : "border-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
              )}
            >
              {t.tabs[item]}
              {item === "reviews" && openReviewCount > 0 ? (
                <span className="ml-1.5 inline-flex min-w-5 justify-center rounded-md bg-warning-container px-1 type-caption text-on-warning-container">
                  {openReviewCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`ielts-panel-${tab}`}
        aria-labelledby={`ielts-tab-${tab}`}
        tabIndex={0}
        className="mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {tab === "overview" && (
          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard
                  icon={Users}
                  label={t.metrics.students}
                  value={summary?.totalStudents ?? 0}
                />
                <MetricCard
                  icon={ClipboardList}
                  label={t.metrics.review}
                  value={summary?.needsReview ?? 0}
                />
                <MetricCard
                  icon={GraduationCap}
                  label={t.metrics.band}
                  value={formatBand(summary?.averageOverallBand ?? null)}
                />
                <MetricCard
                  icon={CheckCircle2}
                  label={t.metrics.attendance}
                  value={
                    attendanceAverage == null ? "—" : `${attendanceAverage}%`
                  }
                />
              </div>
              <div className="rounded-control border border-outline-variant bg-surface">
                <div className="border-b border-outline-variant px-3 py-2.5">
                  <h3 className="type-label font-medium text-on-surface">
                    {t.skills}
                  </h3>
                </div>
                <div className="grid grid-cols-2 divide-x divide-y divide-outline-variant sm:grid-cols-4 sm:divide-y-0">
                  {(
                    ["listening", "reading", "writing", "speaking"] as const
                  ).map((skill) => (
                    <div key={skill} className="px-3 py-3">
                      <p className="type-caption text-on-surface-variant">
                        {t[skill]}
                      </p>
                      <p className="mt-1 type-body font-medium text-on-surface">
                        {formatBand(summary?.skillAverages[skill] ?? null)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-control border border-outline-variant bg-surface">
              <div className="border-b border-outline-variant px-3 py-2.5">
                <h3 className="type-label font-medium text-on-surface">
                  {t.progress}
                </h3>
              </div>
              {(
                data.gradebook?.rows
                  .flatMap((row) => row.courses)
                  .slice(0, 4) ?? []
              ).length ? (
                <div className="divide-y divide-outline-variant">
                  {data.gradebook?.rows
                    .flatMap((row) => row.courses)
                    .slice(0, 4)
                    .map((course, index) => (
                      <div
                        key={`${course.courseId}-${index}`}
                        className="px-3 py-3"
                      >
                        <div className="flex justify-between gap-3 type-label">
                          <span className="truncate font-medium text-on-surface">
                            {course.title}
                          </span>
                          <span className="text-on-surface-variant">
                            {course.percent}%
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${Math.min(100, Math.max(0, course.percent))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="px-3 py-8 text-center type-body-sm text-on-surface-variant">
                  {t.noProgress}
                </p>
              )}
            </div>
          </div>
        )}

        {tab === "gradebook" &&
          (!data.gradebook?.rows.length ? (
            <EmptyState icon={GraduationCap}>{t.emptyGradebook}</EmptyState>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-control border border-outline-variant bg-surface lg:block">
                <table className="w-full min-w-[760px] border-collapse text-left type-label">
                  <thead className="bg-surface-container text-on-surface-variant">
                    <tr>
                      <th className="h-10 px-3 font-medium">{t.student}</th>
                      <th className="h-10 px-3 font-medium">{t.attendance}</th>
                      {assignments.map((assignment) => (
                        <th
                          key={assignment.assignmentId}
                          className="h-10 min-w-40 px-3 font-medium"
                        >
                          {assignment.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {data.gradebook.rows.map((row) => (
                      <tr
                        key={row.userId}
                        className="hover:bg-surface-container/50"
                      >
                        <td className="h-10 px-3">
                          <p className="font-medium text-on-surface">
                            {row.displayName || row.email}
                          </p>
                          <p className="type-caption text-on-surface-variant">
                            {row.email}
                          </p>
                        </td>
                        <td className="h-10 px-3 text-on-surface">
                          {row.attendance.rate == null
                            ? "—"
                            : `${Math.round(row.attendance.rate * 100)}%`}
                        </td>
                        {assignments.map((column) => {
                          const value = row.assignments.find(
                            (item) => item.assignmentId === column.assignmentId,
                          );
                          return (
                            <td key={column.assignmentId} className="h-10 px-3">
                              {value ? (
                                <ScoreCell score={value.score} t={t} />
                              ) : (
                                "—"
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 lg:hidden">
                {data.gradebook.rows.map((row) => (
                  <article
                    key={row.userId}
                    className="rounded-control border border-outline-variant bg-surface p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="type-body-sm font-medium text-on-surface">
                          {row.displayName || row.email}
                        </h3>
                        <p className="type-caption text-on-surface-variant">
                          {row.email}
                        </p>
                      </div>
                      <StatusBadge>
                        {row.attendance.rate == null
                          ? "—"
                          : `${Math.round(row.attendance.rate * 100)}%`}
                      </StatusBadge>
                    </div>
                    <div className="mt-3 divide-y divide-outline-variant border-t border-outline-variant">
                      {row.assignments.map((assignment) => (
                        <div
                          key={assignment.assignmentId}
                          className="flex items-center justify-between gap-3 py-2"
                        >
                          <span className="type-label text-on-surface">
                            {assignment.title}
                          </span>
                          <ScoreCell score={assignment.score} t={t} />
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </>
          ))}

        {tab === "reviews" &&
          (reviewQueue.length === 0 ? (
            <EmptyState icon={CheckCircle2}>{t.emptyReviews}</EmptyState>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <div className="overflow-hidden rounded-control border border-outline-variant bg-surface">
                {reviewQueue.map((item) => {
                  const status =
                    reviewOverrides[item.key]?.status ??
                    item.target.currentReviewStatus;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSelectedReviewKey(item.key)}
                      aria-current={
                        selectedReview?.key === item.key ? "true" : undefined
                      }
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between gap-3 border-b border-outline-variant px-3 py-2 text-left last:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        selectedReview?.key === item.key
                          ? "bg-primary/8"
                          : "hover:bg-surface-container",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate type-label font-medium text-on-surface">
                          {item.student.displayName || item.student.email}
                        </span>
                        <span className="block truncate type-caption text-on-surface-variant">
                          {item.assignment.title} ·{" "}
                          {reviewTargetLabel(item.target, t)}
                        </span>
                      </span>
                      <StatusBadge
                        tone={
                          status === "published"
                            ? "success"
                            : status === "none" || status === "draft"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {t.statusLabels[status]}
                      </StatusBadge>
                    </button>
                  );
                })}
              </div>
              {selectedReview ? (
                <div
                  ref={detailRef}
                  tabIndex={-1}
                  aria-busy={isPending}
                  className="rounded-control border border-outline-variant bg-surface p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="type-caption font-medium uppercase tracking-wide text-on-surface-variant">
                        {t.reviewDetail}
                      </p>
                      <h3 className="mt-1 type-body font-medium text-on-surface">
                        {selectedReview.assignment.title}
                      </h3>
                      <p className="type-body-sm text-on-surface-variant">
                        {selectedReview.student.displayName ||
                          selectedReview.student.email}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StatusBadge>
                          {reviewTargetLabel(selectedReview.target, t)}
                        </StatusBadge>
                        <StatusBadge>
                          {t.revision} {selectedReview.target.revision}
                        </StatusBadge>
                        <StatusBadge
                          tone={
                            selectedReviewStatus === "published"
                              ? "success"
                              : selectedReviewStatus === "none" ||
                                  selectedReviewStatus === "draft"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {t.statusLabels[selectedReviewStatus]}
                        </StatusBadge>
                      </div>
                    </div>
                    <ScoreCell score={selectedReview.assignment.score} t={t} />
                  </div>
                  <div
                    className={cn(
                      "mt-4 flex flex-wrap items-center justify-between gap-3 rounded-control border px-3 py-2.5",
                      selectedReview.target.scoringStatus === "failed"
                        ? "border-error/25 bg-error-container/35"
                        : "border-outline-variant bg-surface-container-low",
                    )}
                  >
                    <div>
                      <p className="type-label font-medium text-on-surface">
                        {t.scoringStatus}:{" "}
                        {
                          t.scoringStatusLabels[
                            selectedReview.target.scoringStatus
                          ]
                        }
                      </p>
                      {selectedReview.target.scoringStatus === "failed" ? (
                        <p className="mt-0.5 type-caption text-on-surface-variant">
                          {t.scoringFailed}
                        </p>
                      ) : null}
                    </div>
                    {selectedReview.target.manualRetryAvailable ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={handleRetryScoring}
                        className="inline-flex h-8 items-center gap-2 rounded-control border border-outline-variant bg-surface px-3 type-label font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RotateCcw className="h-4 w-4" />
                        {isPending ? t.saving : t.retryScoring}
                      </button>
                    ) : null}
                  </div>
                  <form
                    key={`${selectedReview.key}:${selectedReviewId ?? "new"}:${selectedReviewStatus}`}
                    onSubmit={handleSaveReview}
                    className="mt-4"
                  >
                    <fieldset
                      disabled={
                        isPending ||
                        selectedReviewStatus === "published" ||
                        selectedReviewStatus === "returned"
                      }
                    >
                      <legend className="sr-only">{t.reviewDetail}</legend>
                      <div className="overflow-x-auto rounded-control border border-outline-variant">
                        <div className="grid min-w-[520px] grid-cols-[minmax(180px,1fr)_72px_116px_72px] bg-surface-container px-3 py-2 type-caption font-medium text-on-surface-variant">
                          <span>{t.criterion}</span>
                          <span>{t.ai}</span>
                          <span>{t.teacher}</span>
                          <span>{t.effective}</span>
                        </div>
                        {selectedBandKeys.map((key) => {
                          const criterion = selectedReview.target.criteria.find(
                            (item) => item.key === key,
                          );
                          const hasOverride =
                            Object.prototype.hasOwnProperty.call(
                              selectedOverride?.bands ?? {},
                              key,
                            );
                          const teacherBand = hasOverride
                            ? (selectedOverride?.bands[key] ?? null)
                            : (criterion?.teacherBand ?? null);
                          return (
                            <div
                              key={key}
                              className="grid min-w-[520px] grid-cols-[minmax(180px,1fr)_72px_116px_72px] items-center border-t border-outline-variant px-3 py-2.5 type-label"
                            >
                              <div className="min-w-0 pr-3">
                                <label
                                  htmlFor={`teacher-band-${selectedReview.key}-${key}`}
                                  className="font-medium text-on-surface"
                                >
                                  {criterion
                                    ? locale === "vi"
                                      ? criterion.labelVi
                                      : criterion.labelEn
                                    : key}
                                </label>
                                <p
                                  className="truncate type-caption text-on-surface-variant"
                                  title={criterion?.rationale ?? t.noRationale}
                                >
                                  {criterion?.rationale ?? t.noRationale}
                                </p>
                              </div>
                              <output
                                className="tabular-nums text-on-surface-variant"
                                aria-label={`${t.ai}: ${formatBand(criterion?.aiBand ?? null)}`}
                              >
                                {formatBand(criterion?.aiBand ?? null)}
                              </output>
                              <select
                                id={`teacher-band-${selectedReview.key}-${key}`}
                                name={key}
                                defaultValue={
                                  teacherBand == null ? "" : String(teacherBand)
                                }
                                className="h-8 rounded-control border border-outline-variant bg-background px-2 type-body-sm tabular-nums text-on-surface outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <option value="">{t.selectBand}</option>
                                {BAND_OPTIONS.map((band) => (
                                  <option key={band} value={band}>
                                    {band.toFixed(1)}
                                  </option>
                                ))}
                              </select>
                              <output
                                className="font-medium tabular-nums text-on-surface"
                                aria-label={`${t.effective}: ${formatBand(criterion?.effectiveBand ?? null)}`}
                              >
                                {formatBand(criterion?.effectiveBand ?? null)}
                              </output>
                            </div>
                          );
                        })}
                      </div>
                      <label className="mt-3 block">
                        <span className="type-label font-medium text-on-surface-variant">
                          {t.reviewerNote}
                        </span>
                        <textarea
                          name="reviewerNote"
                          rows={3}
                          defaultValue={
                            selectedOverride?.note ??
                            selectedReview.target.currentReviewNote ??
                            ""
                          }
                          className="mt-1 w-full rounded-control border border-outline-variant bg-background px-3 py-2 type-body-sm text-on-surface outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </label>
                      {(selectedReviewStatus === "none" ||
                        selectedReviewStatus === "draft") && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <p className="type-caption text-on-surface-variant">
                            {t.draftPrivate}
                          </p>
                          <button
                            type="submit"
                            disabled={isPending}
                            className="inline-flex h-8 items-center gap-2 rounded-control border border-outline-variant bg-surface px-3 type-label font-medium text-on-surface transition-colors duration-150 hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Save className="h-4 w-4" />
                            {isPending ? t.saving : t.saveReview}
                          </button>
                        </div>
                      )}
                    </fieldset>
                  </form>

                  {selectedReviewStatus === "draft" && selectedReviewId ? (
                    <form
                      onSubmit={handlePublishReview}
                      className="mt-4 rounded-control border border-success/20 bg-success-container/45 p-3"
                    >
                      <p className="type-label font-medium text-on-surface">
                        {t.authoritative}
                      </p>
                      {!selectedBandsComplete ? (
                        <p className="mt-1 type-caption text-on-surface-variant">
                          {t.completeBands}
                        </p>
                      ) : (
                        <label className="mt-2 flex items-start gap-2 type-label text-on-surface">
                          <input
                            type="checkbox"
                            required
                            className="mt-0.5 h-4 w-4 rounded border-outline-variant accent-primary focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <span>{t.publishConfirm}</span>
                        </label>
                      )}
                      <button
                        type="submit"
                        disabled={isPending || !selectedBandsComplete}
                        className="mt-3 inline-flex h-8 items-center gap-2 rounded-control bg-primary px-3 type-label font-medium text-on-primary transition-colors duration-150 hover:bg-primary-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        {isPending ? t.saving : t.publishReview}
                      </button>
                    </form>
                  ) : null}

                  {selectedReviewStatus === "published" && selectedReviewId ? (
                    <form
                      onSubmit={handleReturnReview}
                      className="mt-4 rounded-control border border-warning/25 bg-warning-container/50 p-3"
                    >
                      <p className="type-label font-medium text-on-warning-container">
                        {t.returnHelp}
                      </p>
                      <label className="mt-3 block">
                        <span className="type-label font-medium text-on-warning-container">
                          {t.returnNote}
                        </span>
                        <textarea
                          name="returnNote"
                          required
                          minLength={3}
                          rows={3}
                          className="mt-1 w-full rounded-control border border-warning/30 bg-surface px-3 py-2 type-body-sm text-on-surface outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </label>
                      <label className="mt-2 flex items-start gap-2 type-label text-on-warning-container">
                        <input
                          type="checkbox"
                          required
                          className="mt-0.5 h-4 w-4 rounded border-warning accent-primary focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <span>{t.returnConfirm}</span>
                      </label>
                      <button
                        type="submit"
                        disabled={isPending}
                        className="mt-3 inline-flex h-8 items-center gap-2 rounded-control border border-warning/40 bg-surface px-3 type-label font-medium text-on-warning-container transition-colors duration-150 hover:bg-warning-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RotateCcw className="h-4 w-4" />
                        {isPending ? t.saving : t.returnReview}
                      </button>
                    </form>
                  ) : null}

                  {selectedReviewStatus === "returned" ? (
                    <div className="mt-4 rounded-control border border-outline-variant bg-surface-container px-3 py-2.5 type-label text-on-surface-variant">
                      {t.awaitingResubmission}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}

        {tab === "assignments" &&
          (assignments.length === 0 ? (
            <EmptyState icon={ClipboardList}>{t.emptyAssignments}</EmptyState>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {assignments.map((assignment) => {
                const studentStates =
                  data.gradebook?.rows
                    .map((row) => ({
                      row,
                      value: row.assignments.find(
                        (item) => item.assignmentId === assignment.assignmentId,
                      ),
                    }))
                    .filter((item) => item.value) ?? [];
                return (
                  <article
                    key={assignment.assignmentId}
                    className="rounded-control border border-outline-variant bg-surface"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-outline-variant px-3 py-3">
                      <div>
                        <h3 className="type-body-sm font-medium text-on-surface">
                          {assignment.title}
                        </h3>
                        <p className="mt-0.5 type-caption text-on-surface-variant">
                          {assignment.assignmentType}
                          {assignment.dueAt
                            ? ` · ${t.due} ${formatDate(assignment.dueAt, locale)}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge>{assignment.status}</StatusBadge>
                    </div>
                    <div className="divide-y divide-outline-variant">
                      {studentStates.map(({ row, value }) =>
                        value ? (
                          <div
                            key={row.userId}
                            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="truncate type-label font-medium text-on-surface">
                                {row.displayName || row.email}
                              </p>
                              <p className="type-caption text-on-surface-variant">
                                {value.homework.submitted
                                  ? `${t.homework}: ${value.homework.status}`
                                  : value.attemptId
                                    ? `${t.attempt}: ${value.attemptStatus}`
                                    : t.notSubmitted}
                              </p>
                            </div>
                            <ScoreCell score={value.score} t={t} />
                          </div>
                        ) : null,
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ))}

        {tab === "content" && (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-4">
              <form
                onSubmit={handleResource}
                className="rounded-control border border-outline-variant bg-surface p-4"
              >
                <h3 className="flex items-center gap-2 type-body-sm font-medium text-on-surface">
                  <Plus className="h-4 w-4" />
                  {t.addLink}
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field name="title" label={t.titleField} required />
                  <Field name="url" label={t.url} type="url" required />
                  <Field name="description" label={t.description} />
                  <Field name="provenance" label={t.provenance} />
                </div>
                <SubmitButton
                  pending={isPending}
                  label={t.add}
                  pendingLabel={t.saving}
                />
              </form>
              {data.resources.length ? (
                <div className="overflow-hidden rounded-control border border-outline-variant bg-surface">
                  {data.resources.map((resource) => (
                    <ResourceRow key={resource.id} resource={resource} t={t} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={FileText}>{t.emptyContent}</EmptyState>
              )}
            </div>
            <div className="space-y-4">
              <form
                onSubmit={handleVocabulary}
                className="rounded-control border border-outline-variant bg-surface p-4"
              >
                <h3 className="flex items-center gap-2 type-body-sm font-medium text-on-surface">
                  <Languages className="h-4 w-4" />
                  {t.addVocabulary}
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field name="title" label={t.titleField} required />
                  <Field name="description" label={t.description} />
                  <Field name="term" label={t.term} />
                  <Field name="definition" label={t.definition} />
                  <Field
                    name="translation"
                    label={t.translation}
                    className="sm:col-span-2"
                  />
                </div>
                <SubmitButton
                  pending={isPending}
                  label={t.add}
                  pendingLabel={t.saving}
                />
              </form>
              {data.vocabulary.length ? (
                <div className="overflow-hidden rounded-control border border-outline-variant bg-surface">
                  {data.vocabulary.map((set) => (
                    <div
                      key={set.id}
                      className="border-b border-outline-variant px-3 py-3 last:border-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="type-label font-medium text-on-surface">
                            {set.title}
                          </p>
                          <p className="type-caption text-on-surface-variant">
                            {set.items.length} {t.items}
                          </p>
                        </div>
                        <StatusBadge>{set.status}</StatusBadge>
                      </div>
                      {set.items.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="mt-2 grid grid-cols-[100px_1fr] gap-2 type-caption"
                        >
                          <span className="font-medium text-on-surface">
                            {item.term}
                          </span>
                          <span className="text-on-surface-variant">
                            {item.translation ?? item.definition}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Languages}>{t.emptyVocabulary}</EmptyState>
              )}
            </div>
          </div>
        )}

        {tab === "announcements" && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
            <form
              onSubmit={handleAnnouncement}
              className="rounded-control border border-outline-variant bg-surface p-4"
            >
              <h3 className="flex items-center gap-2 type-body-sm font-medium text-on-surface">
                <Megaphone className="h-4 w-4" />
                {t.newAnnouncement}
              </h3>
              <div className="mt-3 space-y-3">
                <Field name="title" label={t.titleField} required />
                <label className="block">
                  <span className="type-label font-medium text-on-surface-variant">
                    {t.body}
                  </span>
                  <textarea
                    name="body"
                    required
                    rows={5}
                    className="mt-1 w-full rounded-control border border-outline-variant bg-background px-3 py-2 type-body-sm text-on-surface outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <label className="block">
                  <span className="type-label font-medium text-on-surface-variant">
                    {t.status}
                  </span>
                  <select
                    name="status"
                    className="mt-1 h-8 w-full rounded-control border border-outline-variant bg-background px-3 type-body-sm text-on-surface outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="draft">{t.draft}</option>
                    <option value="published">{t.published}</option>
                  </select>
                </label>
              </div>
              <SubmitButton
                pending={isPending}
                label={t.saveDraft}
                pendingLabel={t.saving}
                icon={Send}
              />
            </form>
            {data.announcements.length ? (
              <div className="overflow-hidden rounded-control border border-outline-variant bg-surface">
                {data.announcements.map((announcement) => (
                  <article
                    key={announcement.id}
                    className="border-b border-outline-variant px-4 py-3 last:border-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="type-body-sm font-medium text-on-surface">
                        {announcement.title}
                      </h3>
                      <StatusBadge
                        tone={
                          announcement.status === "published"
                            ? "success"
                            : "neutral"
                        }
                      >
                        {announcement.status}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap type-body-sm text-on-surface-variant">
                      {announcement.body}
                    </p>
                    <p className="mt-2 type-caption text-on-surface-variant">
                      {formatDate(
                        announcement.publishedAt ?? announcement.createdAt,
                        locale,
                      )}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState icon={Megaphone}>{t.emptyAnnouncements}</EmptyState>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = false,
  className,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="type-label font-medium text-on-surface-variant">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-1 h-8 w-full rounded-control border border-outline-variant bg-background px-3 type-body-sm text-on-surface outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}

function SubmitButton({
  pending,
  label,
  pendingLabel,
  icon: Icon = Plus,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
  icon?: typeof Plus;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-3 inline-flex h-8 items-center justify-center gap-2 rounded-control bg-primary px-3 type-label font-medium text-on-primary transition-colors duration-150 hover:bg-primary-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className="h-4 w-4" />
      {pending ? pendingLabel : label}
    </button>
  );
}

function ScoreCell({
  score,
  t,
}: {
  score: IeltsClassGradebook["rows"][number]["assignments"][number]["score"];
  t: typeof copy.en | typeof copy.vi;
}) {
  if (score.overall != null)
    return (
      <span className="inline-flex items-center gap-1.5">
        <strong className="font-medium text-on-surface">
          {formatBand(score.overall)}
        </strong>
        <StatusBadge tone="success">{t.official}</StatusBadge>
      </span>
    );
  if (score.provisional != null)
    return (
      <span className="inline-flex items-center gap-1.5">
        <strong className="font-medium text-on-surface-variant">
          {formatBand(score.provisional)}
        </strong>
        <StatusBadge tone="warning">{t.provisional}</StatusBadge>
      </span>
    );
  return <span className="text-on-surface-variant">—</span>;
}

function ResourceRow({
  resource,
  t,
}: {
  resource: LmsResource;
  t: typeof copy.en | typeof copy.vi;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-outline-variant px-3 py-3 last:border-0">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container">
        <BookOpen className="h-4 w-4 text-on-surface-variant" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate type-label font-medium text-on-surface">
            {resource.title}
          </p>
          <StatusBadge>{resource.status}</StatusBadge>
        </div>
        {resource.description ? (
          <p className="mt-0.5 line-clamp-2 type-caption text-on-surface-variant">
            {resource.description}
          </p>
        ) : null}
        {resource.url ? (
          <a
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 type-caption font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t.open}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
