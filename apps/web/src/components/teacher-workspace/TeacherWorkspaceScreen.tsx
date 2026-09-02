"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import {
  BookOpenText,
  CalendarDays,
  ClipboardList,
  ExternalLink,
  FileText,
  GraduationCap,
  LayoutGrid,
  Megaphone,
  Search,
  Shield,
  Users,
  X,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import type {
  TeacherAssignmentPresentation,
  TeacherReviewPresentation,
  TeacherWorkspacePresentation,
  TeacherWorkspaceSurface,
} from "@/lib/teacher-workspace/presentation";
import { isHeadTeacherWorkspaceSurface } from "@/lib/teacher-workspace/presentation";
import { cn } from "@/lib/utils";
import { HeadTeacherOperations } from "./HeadTeacherOperations";
import { TeacherCalendar } from "./TeacherCalendar";

type CoreTeacherSurface = Exclude<
  TeacherWorkspaceSurface,
  | "calendar"
  | "class-detail"
  | "organization"
  | "people"
  | "curriculum"
  | "reports"
>;

const SURFACE_COPY: Record<
  CoreTeacherSurface,
  { en: [string, string]; vi: [string, string] }
> = {
  classes: {
    en: [
      "My Classes",
      "Open a stable class workspace for lessons, roster, work, and communication.",
    ],
    vi: [
      "Lớp của tôi",
      "Mở không gian lớp học cho bài giảng, học viên, bài tập và thông báo.",
    ],
  },
  "review-queue": {
    en: [
      "Review Queue",
      "One deterministic inbox for homework, IELTS Writing, and Speaking.",
    ],
    vi: [
      "Hàng đợi chấm bài",
      "Một hộp thư ổn định cho bài tập, IELTS Writing và Speaking.",
    ],
  },
  assignments: {
    en: [
      "Assignments",
      "Track assigned, submitted, reviewed, and missing work across classes.",
    ],
    vi: [
      "Bài tập",
      "Theo dõi bài đã giao, đã nộp, đã chấm và còn thiếu ở mọi lớp.",
    ],
  },
  gradebook: {
    en: [
      "Gradebook",
      "Scan class progress, then open a cell for evidence and focused grading.",
    ],
    vi: [
      "Sổ điểm",
      "Xem tiến độ toàn lớp, sau đó mở từng ô để chấm dựa trên minh chứng.",
    ],
  },
  attendance: {
    en: [
      "Attendance",
      "Mark the roster by exception and save one session at a time.",
    ],
    vi: [
      "Điểm danh",
      "Đánh dấu ngoại lệ trong danh sách và lưu theo từng buổi học.",
    ],
  },
  materials: {
    en: [
      "Materials",
      "Organize class-ready resources with clear draft and release states.",
    ],
    vi: [
      "Tài liệu",
      "Quản lý tài nguyên lớp học với trạng thái nháp và phát hành rõ ràng.",
    ],
  },
  announcements: {
    en: [
      "Announcements",
      "Draft, schedule, and review class communication in one place.",
    ],
    vi: [
      "Thông báo",
      "Soạn, hẹn lịch và kiểm tra thông báo lớp học tại một nơi.",
    ],
  },
};

function formatDateTime(value: string | null, locale: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function teacherHref(path: string, data: TeacherWorkspacePresentation) {
  if (data.source !== "explicit_demo") return path;
  return `${path}${path.includes("?") ? "&" : "?"}demo=teacher`;
}

function SurfaceHeader({
  surface,
  locale,
  action,
}: {
  surface: CoreTeacherSurface;
  locale: string;
  action?: React.ReactNode;
}) {
  const vi = locale === "vi";
  const [title, description] = SURFACE_COPY[surface][vi ? "vi" : "en"];
  return (
    <header className="flex flex-col gap-3 border-b border-outline-variant pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="type-label font-semibold uppercase tracking-wide text-primary">
          {vi ? "Không gian giáo viên" : "Teacher workspace"}
        </p>
        <h1 className="mt-1 type-heading-md font-semibold text-on-surface">
          {title}
        </h1>
        <p className="mt-0.5 max-w-3xl type-body-sm text-on-surface-variant">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

function StatusPill({
  value,
  locale = "en",
}: {
  value: string;
  locale?: string;
}) {
  const success = ["published", "returned", "closed", "present"].includes(
    value,
  );
  const danger = ["missing", "absent", "needs_review"].includes(value);
  const label =
    locale === "vi"
      ? ({
          published: "Đã đăng",
          returned: "Đã trả",
          closed: "Đã đóng",
          present: "Có mặt",
          missing: "Còn thiếu",
          absent: "Vắng",
          needs_review: "Cần chấm",
          assigned: "Đã giao",
          draft: "Bản nháp",
          scheduled: "Đã lên lịch",
          late: "Đi muộn",
        }[value] ?? value.replaceAll("_", " "))
      : value.replaceAll("_", " ");
  return (
    <span
      className={cn(
        "inline-flex min-h-5 items-center rounded-md px-1.5 type-caption font-semibold capitalize",
        success
          ? "bg-success-container text-on-success-container"
          : danger
            ? "bg-error-container text-on-error-container"
            : "bg-surface-container-high text-on-surface-variant",
      )}
    >
      {label}
    </span>
  );
}

function SearchField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <label className="relative block min-w-0 flex-1 sm:max-w-sm">
      <Search
        className="pointer-events-none absolute left-3 top-2 size-4 text-on-surface-variant"
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        className="h-8 w-full rounded-control border border-outline-variant bg-surface pl-9 pr-3 type-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </label>
  );
}

function ClassesSurface({ data }: { data: TeacherWorkspacePresentation }) {
  const vi = data.locale === "vi";
  const [query, setQuery] = useState("");
  const classes = data.classes.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <SurfaceHeader surface="classes" locale={data.locale} />
      <div className="mt-3">
        <SearchField
          value={query}
          onChange={setQuery}
          label={vi ? "Tìm lớp" : "Search classes"}
        />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {classes.map((item) => (
          <article
            key={item.id}
            className="rounded-[12px] border border-outline-variant bg-surface p-4 shadow-token-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="type-caption font-semibold uppercase tracking-wide text-primary">
                  {item.programType.replaceAll("_", " ")}
                </span>
                <h2 className="mt-1 type-body font-semibold text-on-surface">
                  {item.title}
                </h2>
                <p className="mt-1 type-caption text-on-surface-variant">
                  {item.studentCount || "—"} {vi ? "học viên" : "learners"} ·{" "}
                  {item.room ?? (vi ? "Chưa có phòng" : "Room not set")}
                </p>
              </div>
              <span
                className="size-3 shrink-0 rounded-full bg-primary"
                aria-hidden="true"
              />
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 border-y border-outline-variant py-3 text-center">
              <div>
                <dt className="type-caption text-on-surface-variant">
                  {vi ? "Tiến độ" : "Progress"}
                </dt>
                <dd className="type-body font-semibold tabular-nums text-on-surface">
                  {item.completion || "—"}
                  {item.completion ? "%" : ""}
                </dd>
              </div>
              <div>
                <dt className="type-caption text-on-surface-variant">
                  {vi ? "Có mặt" : "Attendance"}
                </dt>
                <dd className="type-body font-semibold tabular-nums text-on-surface">
                  {item.attendanceRate || "—"}
                  {item.attendanceRate ? "%" : ""}
                </dd>
              </div>
              <div>
                <dt className="type-caption text-on-surface-variant">
                  {vi ? "Cần chấm" : "To review"}
                </dt>
                <dd className="type-body font-semibold tabular-nums text-on-surface">
                  {item.pendingReviews}
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="type-caption text-on-surface-variant">
                {item.nextLessonAt
                  ? `${vi ? "Tiếp theo" : "Next"}: ${formatDateTime(item.nextLessonAt, data.locale)}`
                  : vi
                    ? "Chưa có lịch"
                    : "No upcoming lesson"}
              </p>
              <Button
                nativeButton={false}
                render={
                  <Link
                    href={teacherHref(
                      `/dashboard/teacher/classes/${item.id}`,
                      data,
                    )}
                  />
                }
                size="sm"
              >
                {vi ? "Mở lớp" : "Open class"}
                <ExternalLink />
              </Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function ReviewSurface({ data }: { data: TeacherWorkspacePresentation }) {
  const vi = data.locale === "vi";
  const isDemo = data.source === "explicit_demo";
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("needs_review");
  const [reviews, setReviews] = useState(data.reviews);
  const [feedback, setFeedback] = useState("");
  const [selected, setSelected] = useState<TeacherReviewPresentation | null>(
    null,
  );
  const rows = reviews
    .filter((item) => status === "all" || item.status === status)
    .filter((item) =>
      `${item.studentName} ${item.assignmentTitle} ${item.classTitle}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  return (
    <>
      <SurfaceHeader surface="review-queue" locale={data.locale} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SearchField
          value={query}
          onChange={setQuery}
          label={vi ? "Tìm học viên hoặc bài tập" : "Search learner or work"}
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-8 rounded-control border border-outline-variant bg-surface px-2 type-caption font-semibold text-on-surface"
          aria-label={vi ? "Lọc trạng thái" : "Filter status"}
        >
          <option value="needs_review">
            {vi ? "Cần chấm" : "Needs review"}
          </option>
          <option value="returned">{vi ? "Đã trả" : "Returned"}</option>
          <option value="draft">{vi ? "Bản nháp" : "Draft"}</option>
          <option value="all">{vi ? "Tất cả" : "All"}</option>
        </select>
        <span className="type-caption text-on-surface-variant">
          {vi ? "Sắp xếp: cũ nhất trước" : "Sorted: oldest first"}
        </span>
      </div>
      <div className="mt-3 overflow-x-auto rounded-control border border-outline-variant bg-surface">
        <table className="w-full min-w-[48rem] border-collapse text-left">
          <thead className="bg-surface-container-low type-caption uppercase tracking-wide text-on-surface-variant">
            <tr>
              <th className="px-3 py-2.5">{vi ? "Học viên" : "Learner"}</th>
              <th className="px-3 py-2.5">{vi ? "Bài" : "Work"}</th>
              <th className="px-3 py-2.5">{vi ? "Lớp" : "Class"}</th>
              <th className="px-3 py-2.5">{vi ? "Đã nhận" : "Received"}</th>
              <th className="px-3 py-2.5">{vi ? "Trạng thái" : "Status"}</th>
              <th className="px-3 py-2.5">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {rows.map((item) => (
              <tr key={item.key} className="hover:bg-surface-container-low">
                <td className="px-3 py-3 type-label font-semibold text-on-surface">
                  {item.studentName}
                  <span className="mt-0.5 block type-caption font-normal text-on-surface-variant">
                    {item.attemptLabel}
                  </span>
                </td>
                <td className="px-3 py-3 type-body-sm text-on-surface">
                  {item.assignmentTitle}
                  <span className="mt-0.5 block type-caption capitalize text-on-surface-variant">
                    {item.kind} · {item.scoreSource.replaceAll("_", " ")}
                  </span>
                </td>
                <td className="px-3 py-3 type-body-sm text-on-surface-variant">
                  {item.classTitle}
                </td>
                <td className="px-3 py-3 type-caption tabular-nums text-on-surface-variant">
                  {formatDateTime(item.submittedAt, data.locale)}
                  <span className="block">{item.ageDays}d</span>
                </td>
                <td className="px-3 py-3">
                  <StatusPill value={item.status} locale={data.locale} />
                </td>
                <td className="px-3 py-3 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (
                        !isDemo &&
                        item.responseId &&
                        (item.kind === "writing" || item.kind === "speaking")
                      ) {
                        router.push(
                          `/dashboard/teacher/classes/${item.classId}?workbenchTab=reviews&responseId=${encodeURIComponent(item.responseId)}`,
                        );
                        return;
                      }
                      setFeedback("");
                      setSelected(item);
                    }}
                  >
                    {vi ? "Chấm" : "Review"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="p-8 text-center type-body-sm text-on-surface-variant">
            {vi ? "Không có bài phù hợp." : "No matching work."}
          </p>
        ) : null}
      </div>
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent
          side="right"
          className="data-[side=right]:w-full data-[side=right]:max-w-none data-[side=right]:sm:max-w-[31rem] gap-0 border-outline-variant bg-surface p-0"
          showCloseButton={false}
        >
          {selected ? (
            <>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label={vi ? "Đóng bảng chấm bài" : "Close review panel"}
                className="absolute right-3 top-3 z-20 flex size-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
              <SheetHeader className="border-b border-outline-variant p-5 pr-14">
                <SheetTitle className="type-title font-semibold text-on-surface">
                  {selected.assignmentTitle}
                </SheetTitle>
                <SheetDescription>
                  {selected.studentName} · {selected.classTitle} ·{" "}
                  {selected.attemptLabel}
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="min-h-64 rounded-control border border-outline-variant bg-surface-container-low p-4">
                  <p className="type-caption font-semibold uppercase tracking-wide text-on-surface-variant">
                    {vi ? "Minh chứng bài làm" : "Submission evidence"}
                  </p>
                  <p className="mt-4 type-body-sm leading-6 text-on-surface">
                    {vi
                      ? "Bản xem trước bài làm và minh chứng rubric xuất hiện tại đây. Hàng đợi giữ nguyên vị trí khi đóng bảng."
                      : "The submitted artifact and rubric evidence appear here. Closing this panel preserves queue position."}
                  </p>
                </div>
                <label className="mt-4 grid gap-1 type-label font-semibold text-on-surface">
                  {vi ? "Phản hồi giáo viên" : "Teacher feedback"}
                  <textarea
                    rows={6}
                    value={feedback}
                    onChange={(event) => setFeedback(event.target.value)}
                    className="rounded-control border border-outline-variant bg-surface p-3 type-body-sm font-normal"
                    placeholder={
                      vi
                        ? "Viết phản hồi có thể thực hiện..."
                        : "Write actionable feedback..."
                    }
                  />
                </label>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    disabled={!isDemo}
                    onClick={() => {
                      if (!selected) return;
                      setReviews((current) =>
                        current.map((item) =>
                          item.key === selected.key
                            ? { ...item, status: "draft" }
                            : item,
                        ),
                      );
                      setSelected(null);
                    }}
                  >
                    {vi ? "Lưu nháp" : "Save draft"}
                  </Button>
                  <Button
                    disabled={!isDemo || feedback.trim().length < 3}
                    onClick={() => {
                      if (!selected) return;
                      setReviews((current) =>
                        current.map((item) =>
                          item.key === selected.key
                            ? {
                                ...item,
                                status: "returned",
                                scoreSource: "teacher_published",
                              }
                            : item,
                        ),
                      );
                      setSelected(null);
                    }}
                  >
                    {vi ? "Xuất bản phản hồi" : "Publish feedback"}
                  </Button>
                </div>
                {!isDemo ? (
                  <p className="mt-3 type-caption text-on-surface-variant">
                    {vi
                      ? "Thao tác chấm bài sẽ bật khi hợp đồng ghi dữ liệu được bàn giao."
                      : "Review mutations stay disabled until the write contract is available."}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function AssignmentTable({
  assignments,
  locale,
}: {
  assignments: TeacherAssignmentPresentation[];
  locale: string;
}) {
  const vi = locale === "vi";
  return (
    <div className="overflow-x-auto rounded-control border border-outline-variant bg-surface">
      <table className="w-full min-w-[52rem] text-left">
        <thead className="bg-surface-container-low type-caption uppercase tracking-wide text-on-surface-variant">
          <tr>
            <th className="px-3 py-2.5">{vi ? "Bài tập" : "Assignment"}</th>
            <th className="px-3 py-2.5">{vi ? "Lớp" : "Class"}</th>
            <th className="px-3 py-2.5">{vi ? "Hạn" : "Due"}</th>
            <th className="px-3 py-2.5">{vi ? "Đã nộp" : "Submitted"}</th>
            <th className="px-3 py-2.5">{vi ? "Đã chấm" : "Reviewed"}</th>
            <th className="px-3 py-2.5">{vi ? "Thiếu" : "Missing"}</th>
            <th className="px-3 py-2.5">{vi ? "Trạng thái" : "Status"}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {assignments.map((item) => (
            <tr key={item.id} className="hover:bg-surface-container-low">
              <td className="px-3 py-3 type-label font-semibold text-on-surface">
                {item.title}
                <span className="mt-0.5 block type-caption font-normal capitalize text-on-surface-variant">
                  {item.kind}
                </span>
              </td>
              <td className="px-3 py-3 type-body-sm text-on-surface-variant">
                {item.classTitle}
              </td>
              <td className="px-3 py-3 type-caption tabular-nums text-on-surface-variant">
                {formatDateTime(item.dueAt, locale)}
              </td>
              <td className="px-3 py-3 type-body-sm font-semibold tabular-nums text-on-surface">
                {item.submitted}
              </td>
              <td className="px-3 py-3 type-body-sm font-semibold tabular-nums text-on-surface">
                {item.reviewed}
              </td>
              <td className="px-3 py-3 type-body-sm font-semibold tabular-nums text-on-surface">
                {item.missing}
              </td>
              <td className="px-3 py-3">
                <StatusPill value={item.status} locale={locale} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssignmentsSurface({ data }: { data: TeacherWorkspacePresentation }) {
  const vi = data.locale === "vi";
  const isDemo = data.source === "explicit_demo";
  const [query, setQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [assignments, setAssignments] = useState(data.assignments);
  const filtered = assignments.filter((item) =>
    `${item.title} ${item.classTitle}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <SurfaceHeader
        surface="assignments"
        locale={data.locale}
        action={
          <Button
            disabled={!isDemo}
            onClick={() => setComposerOpen((open) => !open)}
          >
            <FileText />
            {vi ? "Tạo bài tập" : "Create assignment"}
          </Button>
        }
      />
      {composerOpen ? (
        <form
          className="mt-3 grid gap-3 rounded-control border border-outline-variant bg-primary-container p-4 sm:grid-cols-2"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (!isDemo) return;
            const form = new FormData(event.currentTarget);
            const classId = String(form.get("classId") ?? data.classes[0]?.id);
            const classItem = data.classes.find((item) => item.id === classId);
            const due = String(form.get("due") ?? "");
            setAssignments((current) => [
              {
                id: `preview-assignment-${current.length + 1}`,
                classId,
                classTitle: classItem?.title ?? "Class",
                title: String(form.get("title") ?? "New assignment"),
                kind: String(
                  form.get("kind") ?? "homework",
                ) as TeacherAssignmentPresentation["kind"],
                dueAt: new Date(due).toISOString(),
                status: "assigned",
                submitted: 0,
                reviewed: 0,
                missing: classItem?.studentCount ?? 0,
              },
              ...current,
            ]);
            setComposerOpen(false);
          }}
        >
          <input
            name="title"
            required
            aria-label={vi ? "Tên bài tập" : "Assignment title"}
            placeholder={vi ? "Tên bài tập" : "Assignment title"}
            className="h-9 rounded-control border border-outline-variant bg-surface px-3 type-body-sm"
          />
          <select
            name="classId"
            aria-label={vi ? "Chọn lớp" : "Choose class"}
            className="h-9 rounded-control border border-outline-variant bg-surface px-3 type-body-sm"
          >
            {data.classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <select
            name="kind"
            aria-label={vi ? "Loại bài tập" : "Assignment type"}
            className="h-9 rounded-control border border-outline-variant bg-surface px-3 type-body-sm"
          >
            {(
              [
                "homework",
                "reading",
                "listening",
                "writing",
                "speaking",
              ] as const
            ).map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
          <input
            name="due"
            type="datetime-local"
            required
            defaultValue="2026-09-08T17:00"
            aria-label={vi ? "Hạn nộp" : "Due date"}
            className="h-9 rounded-control border border-outline-variant bg-surface px-3 type-body-sm"
          />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setComposerOpen(false)}
            >
              {vi ? "Hủy" : "Cancel"}
            </Button>
            <Button type="submit">{vi ? "Giao bài" : "Assign"}</Button>
          </div>
        </form>
      ) : null}
      <div className="mt-3">
        <SearchField
          value={query}
          onChange={setQuery}
          label={vi ? "Tìm bài tập" : "Search assignments"}
        />
      </div>
      <div className="mt-3">
        <AssignmentTable assignments={filtered} locale={data.locale} />
      </div>
    </>
  );
}

function GradebookSurface({ data }: { data: TeacherWorkspacePresentation }) {
  const vi = data.locale === "vi";
  const isDemo = data.source === "explicit_demo";
  const [scores, setScores] = useState(data.gradebook.scores);
  const [selectedCell, setSelectedCell] = useState<{
    studentId: string;
    assessmentId: string;
  } | null>(null);
  const [scoreInput, setScoreInput] = useState("");
  const selectedStudent = data.gradebook.students.find(
    (item) => item.id === selectedCell?.studentId,
  );
  const selectedAssessment = data.gradebook.assessments.find(
    (item) => item.id === selectedCell?.assessmentId,
  );
  const numericScore = Number(scoreInput);
  const scoreValid =
    scoreInput !== "" &&
    Number.isFinite(numericScore) &&
    numericScore >= 0 &&
    numericScore <= (selectedAssessment?.maxScore ?? 100);
  if (!data.gradebook.students.length || !data.gradebook.assessments.length) {
    return (
      <>
        <SurfaceHeader surface="gradebook" locale={data.locale} />
        <div
          className="mt-3 rounded-control border border-outline-variant bg-surface px-5 py-10 text-center"
          role="status"
        >
          <h2 className="type-body font-semibold text-on-surface">
            {vi ? "Chưa có dữ liệu sổ điểm" : "No gradebook data yet"}
          </h2>
          <p className="mt-1 type-body-sm text-on-surface-variant">
            {vi
              ? "Các bài đánh giá và học viên của lớp này sẽ xuất hiện tại đây."
              : "Assessments and learners for this class will appear here."}
          </p>
        </div>
      </>
    );
  }
  return (
    <>
      <SurfaceHeader surface="gradebook" locale={data.locale} />
      <div
        className="mt-3 overflow-auto rounded-control border border-outline-variant bg-surface"
        data-gradebook-scroller
      >
        <table className="min-w-[56rem] border-separate border-spacing-0 text-left">
          <thead>
            <tr className="bg-surface-container-low type-caption uppercase tracking-wide text-on-surface-variant">
              <th className="sticky left-0 top-0 z-20 min-w-48 border-b border-r border-outline-variant bg-surface-container-low px-3 py-3">
                {vi ? "Học viên" : "Learner"}
              </th>
              {data.gradebook.assessments.map((assessment) => (
                <th
                  key={assessment.id}
                  className="sticky top-0 z-10 min-w-36 border-b border-outline-variant bg-surface-container-low px-3 py-3"
                >
                  {assessment.title}
                  <span className="block font-normal normal-case">
                    /{assessment.maxScore}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.gradebook.students.map((student) => (
              <tr key={student.id} className="hover:bg-surface-container-low">
                <th className="sticky left-0 z-10 border-b border-r border-outline-variant bg-surface px-3 py-3 type-label font-semibold text-on-surface">
                  {student.name}
                </th>
                {data.gradebook.assessments.map((assessment) => {
                  const score = scores[student.id]?.[assessment.id];
                  return (
                    <td
                      key={assessment.id}
                      className="border-b border-outline-variant px-3 py-3"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCell({
                            studentId: student.id,
                            assessmentId: assessment.id,
                          });
                          setScoreInput(
                            typeof score === "number" ? String(score) : "",
                          );
                        }}
                        aria-label={`${student.name}, ${assessment.title}: ${typeof score === "number" ? score : (score ?? "missing")}`}
                        className="min-h-8 min-w-20 rounded-lg border border-outline-variant px-2 type-body-sm font-semibold tabular-nums text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {typeof score === "number" ? (
                          `${score}/${assessment.maxScore}`
                        ) : (
                          <StatusPill
                            value={score ?? "missing"}
                            locale={data.locale}
                          />
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Sheet
        open={Boolean(selectedCell)}
        onOpenChange={(open) => {
          if (!open) setSelectedCell(null);
        }}
      >
        <SheetContent
          side="right"
          className="data-[side=right]:w-full data-[side=right]:sm:max-w-sm bg-surface"
        >
          <SheetHeader>
            <SheetTitle>{vi ? "Cập nhật điểm" : "Grade evidence"}</SheetTitle>
            <SheetDescription>
              {selectedStudent?.name} · {selectedAssessment?.title}
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-4 pb-4">
            <div className="rounded-control border border-outline-variant bg-surface-container-low p-4 type-body-sm text-on-surface-variant">
              {vi
                ? "Mở bài nộp và rubric liên quan trước khi công bố điểm."
                : "Review the linked submission and rubric evidence before publishing a score."}
            </div>
            <label className="grid gap-1 type-label font-semibold text-on-surface">
              {vi ? "Điểm" : "Score"}
              <input
                type="number"
                min={0}
                max={selectedAssessment?.maxScore ?? 100}
                value={scoreInput}
                onChange={(event) => setScoreInput(event.target.value)}
                className="h-9 rounded-control border border-outline-variant bg-surface px-3 type-body-sm font-normal"
              />
            </label>
            <Button
              disabled={!isDemo || !selectedCell || !scoreValid}
              onClick={() => {
                if (!selectedCell) return;
                const numeric = Number(scoreInput);
                if (!scoreValid) return;
                setScores((current) => ({
                  ...current,
                  [selectedCell.studentId]: {
                    ...(current[selectedCell.studentId] ?? {}),
                    [selectedCell.assessmentId]: numeric,
                  },
                }));
                setSelectedCell(null);
              }}
            >
              {vi ? "Lưu điểm bản xem trước" : "Save preview score"}
            </Button>
            {!isDemo ? (
              <p className="type-caption text-on-surface-variant">
                {vi
                  ? "Chỉ đọc cho đến khi hợp đồng ghi sổ điểm được bàn giao."
                  : "Read-only until the gradebook write contract is available."}
              </p>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function AttendanceSurface({ data }: { data: TeacherWorkspacePresentation }) {
  const vi = data.locale === "vi";
  const isDemo = data.source === "explicit_demo";
  const [statuses, setStatuses] = useState(
    Object.fromEntries(data.attendance.map((item) => [item.id, item.status])),
  );
  const [saved, setSaved] = useState(false);
  const values = ["present", "late", "absent", "excused"] as const;
  const attendanceClass = data.classes.find(
    (item) => item.id === data.attendance[0]?.classId,
  );
  if (!data.attendance.length) {
    return (
      <>
        <SurfaceHeader surface="attendance" locale={data.locale} />
        <div
          className="mt-3 rounded-control border border-outline-variant bg-surface px-5 py-10 text-center"
          role="status"
        >
          <h2 className="type-body font-semibold text-on-surface">
            {vi ? "Chưa có danh sách điểm danh" : "No attendance roster yet"}
          </h2>
          <p className="mt-1 type-body-sm text-on-surface-variant">
            {vi
              ? "Danh sách sẽ xuất hiện khi lớp có buổi học và học viên được phân công."
              : "A roster appears after this class has a lesson and assigned learners."}
          </p>
        </div>
      </>
    );
  }
  return (
    <>
      <SurfaceHeader
        surface="attendance"
        locale={data.locale}
        action={
          <Button
            disabled={!isDemo}
            onClick={() => {
              setSaved(true);
              window.setTimeout(() => setSaved(false), 2500);
            }}
          >
            {vi ? "Lưu điểm danh" : "Save attendance"}
          </Button>
        }
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-control border border-outline-variant bg-surface p-3">
        <div>
          <p className="type-label font-semibold text-on-surface">
            {attendanceClass?.title ?? (vi ? "Lớp đã chọn" : "Selected class")}
          </p>
          <p className="type-caption text-on-surface-variant">
            {attendanceClass?.nextLessonAt
              ? formatDateTime(attendanceClass.nextLessonAt, data.locale)
              : vi
                ? "Buổi học tiếp theo chưa được lên lịch"
                : "Next lesson is not scheduled"}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!isDemo}
          onClick={() =>
            setStatuses(
              Object.fromEntries(
                data.attendance.map((item) => [item.id, "present"]),
              ),
            )
          }
        >
          {vi ? "Tất cả có mặt" : "Mark all present"}
        </Button>
      </div>
      {saved ? (
        <p
          className="mt-3 rounded-control bg-success-container px-3 py-2 type-body-sm font-semibold text-on-success-container"
          role="status"
        >
          {vi ? "Đã lưu điểm danh bản xem trước." : "Preview attendance saved."}
        </p>
      ) : null}
      <div className="mt-3 divide-y divide-outline-variant rounded-control border border-outline-variant bg-surface">
        {data.attendance.map((student) => (
          <fieldset
            key={student.id}
            className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <legend className="sr-only">{student.name}</legend>
            <div className="type-label font-semibold text-on-surface">
              {student.name}
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {values.map((value) => (
                <label
                  key={value}
                  className={cn(
                    "flex h-8 cursor-pointer items-center justify-center rounded-control border px-2 type-caption font-semibold capitalize",
                    statuses[student.id] === value
                      ? "border-primary bg-primary-container text-on-primary-container"
                      : "border-outline-variant text-on-surface-variant",
                  )}
                >
                  <input
                    type="radio"
                    disabled={!isDemo}
                    name={`attendance-${student.id}`}
                    value={value}
                    checked={statuses[student.id] === value}
                    onChange={() => {
                      setSaved(false);
                      setStatuses((current) => ({
                        ...current,
                        [student.id]: value,
                      }));
                    }}
                    className="sr-only"
                  />
                  {vi
                    ? {
                        present: "Có mặt",
                        late: "Đi muộn",
                        absent: "Vắng",
                        excused: "Có phép",
                      }[value]
                    : value}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </>
  );
}

function MaterialsSurface({ data }: { data: TeacherWorkspacePresentation }) {
  const vi = data.locale === "vi";
  const isDemo = data.source === "explicit_demo";
  const [query, setQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [materials, setMaterials] = useState(data.materials);
  const [selected, setSelected] = useState<
    TeacherWorkspacePresentation["materials"][number] | null
  >(null);
  const rows = materials.filter((item) =>
    `${item.title} ${item.classTitle}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <SurfaceHeader
        surface="materials"
        locale={data.locale}
        action={
          <Button
            disabled={!isDemo}
            onClick={() => setComposerOpen((open) => !open)}
          >
            <BookOpenText />
            {vi ? "Thêm tài liệu" : "Add material"}
          </Button>
        }
      />
      {composerOpen ? (
        <form
          className="mt-3 grid gap-3 rounded-control border border-outline-variant bg-primary-container p-4 sm:grid-cols-2"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const classId = String(form.get("classId") ?? data.classes[0]?.id);
            const classItem = data.classes.find((item) => item.id === classId);
            setMaterials((current) => [
              {
                id: `preview-material-${current.length + 1}`,
                classId,
                title: String(form.get("title") ?? "Material"),
                classTitle: classItem?.title ?? "Class",
                kind: String(
                  form.get("kind") ?? "document",
                ) as TeacherWorkspacePresentation["materials"][number]["kind"],
                status: "draft",
                updatedAt: "2026-08-31T16:00:00.000Z",
              },
              ...current,
            ]);
            setComposerOpen(false);
          }}
        >
          <input
            name="title"
            required
            aria-label={vi ? "Tên tài liệu" : "Material title"}
            placeholder={vi ? "Tên tài liệu" : "Material title"}
            className="h-9 rounded-control border border-outline-variant bg-surface px-3 type-body-sm"
          />
          <select
            name="classId"
            aria-label={vi ? "Chọn lớp" : "Choose class"}
            className="h-9 rounded-control border border-outline-variant bg-surface px-3 type-body-sm"
          >
            {data.classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <select
            name="kind"
            aria-label={vi ? "Loại tài liệu" : "Material type"}
            className="h-9 rounded-control border border-outline-variant bg-surface px-3 type-body-sm"
          >
            {(["document", "video", "link", "worksheet"] as const).map(
              (kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ),
            )}
          </select>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setComposerOpen(false)}
            >
              {vi ? "Hủy" : "Cancel"}
            </Button>
            <Button type="submit">{vi ? "Thêm bản nháp" : "Add draft"}</Button>
          </div>
        </form>
      ) : null}
      <div className="mt-3">
        <SearchField
          value={query}
          onChange={setQuery}
          label={vi ? "Tìm tài liệu" : "Search materials"}
        />
      </div>
      <div className="mt-3 grid gap-2">
        {rows.map((item) => (
          <article
            key={item.id}
            className="flex flex-col gap-3 rounded-control border border-outline-variant bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 className="type-label font-semibold text-on-surface">
                  {item.title}
                </h2>
                <p className="mt-0.5 type-caption text-on-surface-variant">
                  {item.classTitle} · {item.kind} ·{" "}
                  {formatDateTime(item.updatedAt, data.locale)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill value={item.status} locale={data.locale} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelected(item)}
              >
                {vi ? "Mở" : "Open"}
              </Button>
            </div>
          </article>
        ))}
      </div>
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent
          side="right"
          className="data-[side=right]:w-full data-[side=right]:sm:max-w-sm bg-surface"
        >
          <SheetHeader>
            <SheetTitle>{selected?.title}</SheetTitle>
            <SheetDescription>
              {selected?.classTitle} · {selected?.kind}
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-3 px-4 pb-4">
            <div className="grid min-h-56 place-items-center rounded-control border border-outline-variant bg-surface-container-low p-4 text-center type-body-sm text-on-surface-variant">
              {vi
                ? "Bản xem trước tài liệu và thông tin phát hành xuất hiện tại đây."
                : "Material preview and release details appear here."}
            </div>
            <StatusPill
              value={selected?.status ?? "draft"}
              locale={data.locale}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function AnnouncementsSurface({
  data,
}: {
  data: TeacherWorkspacePresentation;
}) {
  const vi = data.locale === "vi";
  const isDemo = data.source === "explicit_demo";
  const [composerOpen, setComposerOpen] = useState(false);
  const [announcements, setAnnouncements] = useState(data.announcements);
  return (
    <>
      <SurfaceHeader
        surface="announcements"
        locale={data.locale}
        action={
          <Button
            disabled={!isDemo}
            onClick={() => setComposerOpen((open) => !open)}
          >
            <Megaphone />
            {vi ? "Thông báo mới" : "New announcement"}
          </Button>
        }
      />
      {composerOpen ? (
        <form
          className="mt-3 grid gap-3 rounded-control border border-outline-variant bg-primary-container p-4"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (!isDemo) return;
            const form = new FormData(event.currentTarget);
            const classId = String(form.get("classId") ?? data.classes[0]?.id);
            const classItem = data.classes.find((item) => item.id === classId);
            const submitter = (event.nativeEvent as SubmitEvent)
              .submitter as HTMLButtonElement | null;
            const status =
              submitter?.value === "published" ? "published" : "draft";
            setAnnouncements((current) => [
              {
                id: `preview-announcement-${current.length + 1}`,
                classId,
                classTitle: classItem?.title ?? "Class",
                title: String(form.get("title") ?? "Announcement"),
                body: String(form.get("body") ?? ""),
                status,
                publishAt:
                  status === "published" ? "2026-08-31T16:00:00.000Z" : null,
              },
              ...current,
            ]);
            setComposerOpen(false);
          }}
        >
          <input
            name="title"
            required
            aria-label={vi ? "Tiêu đề" : "Title"}
            placeholder={vi ? "Tiêu đề" : "Title"}
            className="h-9 rounded-control border border-outline-variant bg-surface px-3 type-body-sm"
          />
          <textarea
            name="body"
            required
            aria-label={vi ? "Nội dung" : "Message"}
            placeholder={vi ? "Nội dung thông báo" : "Write an announcement"}
            rows={4}
            className="rounded-control border border-outline-variant bg-surface p-3 type-body-sm"
          />
          <select
            name="classId"
            aria-label={vi ? "Chọn lớp" : "Choose class"}
            className="h-9 rounded-control border border-outline-variant bg-surface px-3 type-body-sm"
          >
            {data.classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="submit" value="draft">
              {vi ? "Lưu nháp" : "Save draft"}
            </Button>
            <Button type="submit" value="published">
              {vi ? "Đăng" : "Publish"}
            </Button>
          </div>
        </form>
      ) : null}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {announcements.map((item) => (
          <article
            key={item.id}
            className="rounded-control border border-outline-variant bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="type-caption font-semibold text-primary">
                  {item.classTitle}
                </p>
                <h2 className="mt-1 type-body font-semibold text-on-surface">
                  {item.title}
                </h2>
              </div>
              <StatusPill value={item.status} locale={data.locale} />
            </div>
            <p className="mt-3 type-body-sm leading-6 text-on-surface-variant">
              {item.body}
            </p>
            <p className="mt-3 type-caption text-on-surface-variant">
              {item.publishAt
                ? formatDateTime(item.publishAt, data.locale)
                : vi
                  ? "Chưa lên lịch"
                  : "Not scheduled"}
            </p>
          </article>
        ))}
      </div>
    </>
  );
}

function ClassDetailSurface({
  data,
  classId,
}: {
  data: TeacherWorkspacePresentation;
  classId?: string;
}) {
  const vi = data.locale === "vi";
  const params = useSearchParams();
  const classItem =
    data.classes.find((item) => item.id === classId) ?? data.classes[0];
  const tabs = [
    "overview",
    "lessons",
    "roster",
    "assignments",
    "gradebook",
    "attendance",
    "materials",
    "announcements",
  ] as const;
  type ClassWorkspaceTab = (typeof tabs)[number];
  const requestedTab = params.get("tab");
  const [tab, setTab] = useState<ClassWorkspaceTab>(() =>
    tabs.includes(requestedTab as ClassWorkspaceTab)
      ? (requestedTab as ClassWorkspaceTab)
      : "overview",
  );
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  if (!classItem) return null;
  const scopedData: TeacherWorkspacePresentation = {
    ...data,
    classes: [classItem],
    calendar: {
      ...data.calendar,
      events: data.calendar.events.filter(
        (event) => event.classId === classItem.id,
      ),
      classes: data.calendar.classes.filter((item) => item.id === classItem.id),
    },
    reviews: data.reviews.filter((item) => item.classId === classItem.id),
    assignments: data.assignments.filter(
      (item) => item.classId === classItem.id,
    ),
    gradebook:
      classItem.programType === "ielts"
        ? data.gradebook
        : { students: [], assessments: [], scores: {} },
    attendance: data.attendance.filter((item) => item.classId === classItem.id),
    materials: data.materials.filter((item) => item.classId === classItem.id),
    announcements: data.announcements.filter(
      (item) => item.classId === classItem.id,
    ),
  };
  const tabLabels: Record<string, string> = vi
    ? {
        overview: "Tổng quan",
        lessons: "Bài học",
        roster: "Học viên",
        assignments: "Bài tập",
        gradebook: "Sổ điểm",
        attendance: "Điểm danh",
        materials: "Tài liệu",
        announcements: "Thông báo",
      }
    : {};
  return (
    <>
      <header className="border-b border-outline-variant pb-4">
        <Link
          href={teacherHref("/dashboard/teacher/classes", data)}
          className="type-caption font-semibold text-primary"
        >
          ← {vi ? "Lớp của tôi" : "My Classes"}
        </Link>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="type-label font-semibold uppercase tracking-wide text-primary">
              {classItem.programType.replaceAll("_", " ")}
            </p>
            <h1 className="mt-1 type-heading-md font-semibold text-on-surface">
              {classItem.title}
            </h1>
            <p className="mt-1 type-body-sm text-on-surface-variant">
              {classItem.studentCount || "—"} {vi ? "học viên" : "learners"} ·{" "}
              {classItem.room ?? (vi ? "Chưa có phòng" : "Room not set")}
            </p>
          </div>
          <Button
            nativeButton={false}
            render={
              <Link
                href={teacherHref(
                  `/dashboard/teacher/calendar?classId=${classItem.id}`,
                  data,
                )}
              />
            }
            variant="outline"
          >
            <CalendarDays />
            {vi ? "Xem lịch" : "View calendar"}
          </Button>
        </div>
      </header>
      <div className="mt-3 overflow-x-auto">
        <div
          className="flex min-w-max gap-1 border-b border-outline-variant"
          role="tablist"
          aria-label={vi ? "Không gian lớp" : "Class workspace"}
        >
          {tabs.map((item, index) => (
            <button
              key={item}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              id={`class-tab-${classItem.id}-${item}`}
              type="button"
              role="tab"
              aria-selected={tab === item}
              aria-controls={`class-panel-${classItem.id}`}
              tabIndex={tab === item ? 0 : -1}
              onClick={() => setTab(item)}
              onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                let nextIndex: number | null = null;
                if (event.key === "ArrowRight")
                  nextIndex = (index + 1) % tabs.length;
                if (event.key === "ArrowLeft")
                  nextIndex = (index - 1 + tabs.length) % tabs.length;
                if (event.key === "Home") nextIndex = 0;
                if (event.key === "End") nextIndex = tabs.length - 1;
                if (nextIndex === null) return;
                event.preventDefault();
                const nextTab = tabs[nextIndex];
                setTab(nextTab);
                tabRefs.current[nextIndex]?.focus();
              }}
              className={cn(
                "h-9 border-b-2 border-transparent px-3 type-label font-semibold capitalize text-on-surface-variant",
                tab === item && "border-primary text-primary",
              )}
            >
              {tabLabels[item] ?? item}
            </button>
          ))}
        </div>
      </div>
      <div
        id={`class-panel-${classItem.id}`}
        role="tabpanel"
        aria-labelledby={`class-tab-${classItem.id}-${tab}`}
        className="mt-4"
      >
        {tab === "overview" ? (
          <div className="grid gap-3 md:grid-cols-3">
            <article className="rounded-control border border-outline-variant bg-surface p-4">
              <GraduationCap className="size-5 text-primary" />
              <p className="mt-3 type-caption text-on-surface-variant">
                {vi ? "Tiến độ khóa học" : "Course progress"}
              </p>
              <p className="type-title font-semibold text-on-surface">
                {classItem.completion || "—"}
                {classItem.completion ? "%" : ""}
              </p>
            </article>
            <article className="rounded-control border border-outline-variant bg-surface p-4">
              <Users className="size-5 text-primary" />
              <p className="mt-3 type-caption text-on-surface-variant">
                {vi ? "Tỷ lệ có mặt" : "Attendance rate"}
              </p>
              <p className="type-title font-semibold text-on-surface">
                {classItem.attendanceRate || "—"}
                {classItem.attendanceRate ? "%" : ""}
              </p>
            </article>
            <article className="rounded-control border border-outline-variant bg-surface p-4">
              <ClipboardList className="size-5 text-primary" />
              <p className="mt-3 type-caption text-on-surface-variant">
                {vi ? "Cần chấm" : "Needs review"}
              </p>
              <p className="type-title font-semibold text-on-surface">
                {classItem.pendingReviews}
              </p>
            </article>
          </div>
        ) : null}
        {tab === "assignments" ? (
          <AssignmentTable
            assignments={data.assignments.filter(
              (item) => item.classId === classItem.id,
            )}
            locale={data.locale}
          />
        ) : null}
        {tab === "gradebook" ? <GradebookSurface data={scopedData} /> : null}
        {tab === "attendance" ? <AttendanceSurface data={scopedData} /> : null}
        {tab === "materials" ? <MaterialsSurface data={scopedData} /> : null}
        {tab === "announcements" ? (
          <AnnouncementsSurface data={scopedData} />
        ) : null}
        {tab === "roster" ? (
          <div className="rounded-control border border-outline-variant bg-surface p-4">
            <h2 className="type-body font-semibold text-on-surface">
              {vi ? "Danh sách lớp" : "Roster"}
            </h2>
            <p className="mt-2 type-body-sm text-on-surface-variant">
              {vi
                ? "Hợp đồng hiện tại chỉ cung cấp tổng số học viên trong chi tiết sự kiện."
                : "The current event contract exposes roster count; named rows appear after the roster projection is added."}
            </p>
          </div>
        ) : null}
        {tab === "lessons" ? (
          <div className="rounded-control border border-outline-variant bg-surface p-4">
            <h2 className="type-body font-semibold text-on-surface">
              {vi ? "Bài học sắp tới" : "Upcoming lessons"}
            </h2>
            <p className="mt-2 type-body-sm text-on-surface-variant">
              {vi
                ? "Mở Lịch giảng dạy để soạn bài hoặc xem chi tiết buổi học."
                : "Open Teaching Calendar to plan or inspect a lesson."}
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}

function StateScreen({ data }: { data: TeacherWorkspacePresentation }) {
  const vi = data.locale === "vi";
  const denied = data.state === "denied";
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 py-12 text-center">
      <div className="max-w-md">
        <span className="mx-auto flex size-12 items-center justify-center rounded-[12px] bg-surface-container-high text-primary">
          {denied ? <Shield /> : <LayoutGrid />}
        </span>
        <h1 className="mt-4 type-heading-md font-semibold text-on-surface">
          {denied
            ? vi
              ? "Không có quyền truy cập"
              : "Teacher access required"
            : vi
              ? "Không thể tải không gian"
              : "Workspace unavailable"}
        </h1>
        <p className="mt-2 type-body-sm text-on-surface-variant">
          {denied
            ? vi
              ? "Không gian giáo viên chỉ hiển thị các lớp được phân công hoặc quản lý."
              : "Teacher mode only shows classes assigned to you or managed by your organization."
            : vi
              ? "Dữ liệu giáo viên chưa sẵn sàng trong môi trường này."
              : "Teacher data is not ready in this environment."}
        </p>
        {process.env.NODE_ENV !== "production" ? (
          <Button
            nativeButton={false}
            render={<Link href="/dashboard/teacher?demo=teacher" />}
            className="mt-4"
          >
            {vi ? "Mở bản xem trước" : "Open explicit demo"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function TeacherWorkspaceScreen({
  data,
  classId,
}: {
  data: TeacherWorkspacePresentation;
  classId?: string;
}) {
  if (
    data.state === "denied" ||
    data.state === "error" ||
    (isHeadTeacherWorkspaceSurface(data.surface) && !data.isHeadTeacher)
  )
    return (
      <ProductPageShell>
        <StateScreen
          data={
            isHeadTeacherWorkspaceSurface(data.surface) && !data.isHeadTeacher
              ? { ...data, state: "denied" }
              : data
          }
        />
      </ProductPageShell>
    );
  return (
    <ProductPageShell>
      <PageContainer size="data" className="py-4 lg:py-5">
        {data.source === "explicit_demo" ? (
          /* A necessary disclosure, not a headline: one quiet line so the
             workspace itself owns the top of the page. */
          <div className="mb-3 flex items-center gap-2 rounded-control border border-outline-variant bg-surface-container-low px-3 py-1.5">
            <Shield
              className="size-3.5 shrink-0 text-on-surface-variant"
              aria-hidden="true"
            />
            <p className="type-caption text-on-surface-variant">
              <span className="font-semibold text-on-surface">
                {data.locale === "vi"
                  ? "Bản xem trước giáo viên"
                  : "Teacher presentation preview"}
              </span>
              {" — "}
              {data.locale === "vi"
                ? "dữ liệu minh họa chỉ bật ngoài production."
                : "demo data, never active in production."}
            </p>
          </div>
        ) : null}
        {data.surface === "calendar" ? <TeacherCalendar data={data} /> : null}
        {data.surface === "classes" ? <ClassesSurface data={data} /> : null}
        {data.surface === "review-queue" ? <ReviewSurface data={data} /> : null}
        {data.surface === "assignments" ? (
          <AssignmentsSurface data={data} />
        ) : null}
        {data.surface === "gradebook" ? <GradebookSurface data={data} /> : null}
        {data.surface === "attendance" ? (
          <AttendanceSurface data={data} />
        ) : null}
        {data.surface === "materials" ? <MaterialsSurface data={data} /> : null}
        {data.surface === "announcements" ? (
          <AnnouncementsSurface data={data} />
        ) : null}
        {isHeadTeacherWorkspaceSurface(data.surface) ? (
          <HeadTeacherOperations data={data} surface={data.surface} />
        ) : null}
        {data.surface === "class-detail" ? (
          <ClassDetailSurface data={data} classId={classId} />
        ) : null}
      </PageContainer>
    </ProductPageShell>
  );
}
