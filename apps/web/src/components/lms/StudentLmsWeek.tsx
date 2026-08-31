import { Link } from "@/i18n/navigation";
import { markLmsNotificationRead } from "@/app/actions/class-lms";
import {
  BellRing,
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  ExternalLink,
  MessageSquareText,
} from "@/components/ui/icons";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import type {
  StudentWeeklyAssignment,
  StudentWeeklyLmsView,
  StudentWeeklyOccurrence,
} from "@/lib/api/class-lms/student-weekly-repository";
import { LearnerMaterials } from "@/components/materials/LearnerMaterials";
import type { LearnerMaterialProjection } from "@/components/materials/material-ui-model";

const DAY_MS = 86_400_000;

async function markNotificationRead(notificationId: string) {
  "use server";
  await markLmsNotificationRead(notificationId);
}

function addDays(value: string, days: number): string {
  return new Date(new Date(`${value}T12:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function formatDate(
  value: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(locale, options).format(
    new Date(`${value}T12:00:00Z`),
  );
}

function formatDateTime(value: string, locale: string, timezone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

function formatTime(value: string, locale: string, timezone: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function dateInTimezone(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function statusLabel(value: string | null, vi: boolean) {
  if (!value) return vi ? "Chưa nộp" : "Not submitted";
  const labels: Record<string, string> = vi
    ? {
        submitted: "Đã nộp",
        graded: "Đã chấm",
        returned: "Đã trả bài",
        resubmit_requested: "Cần nộp lại",
        present: "Có mặt",
        late: "Đi muộn",
        absent: "Vắng",
        excused: "Có phép",
      }
    : {
        submitted: "Submitted",
        graded: "Graded",
        returned: "Feedback ready",
        resubmit_requested: "Resubmit requested",
        present: "Present",
        late: "Late",
        absent: "Absent",
        excused: "Excused",
      };
  return labels[value] ?? value.replaceAll("_", " ");
}

function relationLabel(
  value: StudentWeeklyAssignment["relationType"],
  vi: boolean,
) {
  if (value === "prework") return vi ? "Trước buổi học" : "Pre-work";
  if (value === "classwork") return vi ? "Trong buổi học" : "Classwork";
  return vi ? "Bài tập về nhà" : "Homework";
}

function statusTone(value: string | null) {
  if (value === "graded" || value === "returned" || value === "present") {
    return "bg-success-container text-on-success-container";
  }
  if (
    value === "resubmit_requested" ||
    value === "late" ||
    value === "absent"
  ) {
    return "bg-error-container text-on-error-container";
  }
  return "bg-surface-container-high text-on-surface-variant";
}

function groupByDate(occurrences: StudentWeeklyOccurrence[]) {
  return occurrences.reduce<Map<string, StudentWeeklyOccurrence[]>>(
    (groups, occurrence) => {
      const current = groups.get(occurrence.date) ?? [];
      current.push(occurrence);
      groups.set(occurrence.date, current);
      return groups;
    },
    new Map(),
  );
}

function AssignmentRow({
  assignment,
  locale,
  timezone,
}: {
  assignment: StudentWeeklyAssignment;
  locale: string;
  timezone: string;
}) {
  const vi = locale === "vi";
  const statusValue =
    assignment.gradeStatus && assignment.gradeStatus !== "submitted"
      ? assignment.gradeStatus
      : assignment.submissionState;
  const status = statusLabel(statusValue, vi);
  const outcome = assignment.ieltsResult;
  const hasObjectiveOutcome =
    outcome?.readingBand != null || outcome?.listeningBand != null;
  const hasTeacherOutcome =
    assignment.teacherPublished &&
    (outcome?.writingBand != null || outcome?.speakingBand != null);
  const actionLabel =
    assignment.gradeStatus === "resubmit_requested"
      ? vi
        ? "Nộp lại"
        : "Resubmit"
      : assignment.submissionState
        ? vi
          ? "Xem bài"
          : "View submission"
        : vi
          ? "Bắt đầu"
          : "Start";

  return (
    <li className="flex min-h-11 flex-col gap-2 rounded-[10px] border border-outline-variant bg-surface-container-low px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="type-label font-semibold text-on-surface">
          {assignment.title}
        </p>
        <p className="mt-0.5 type-caption text-on-surface-variant">
          {relationLabel(assignment.relationType, vi)}
          {assignment.dueAt
            ? ` · ${vi ? "Hạn" : "Due"} ${formatDateTime(assignment.dueAt, locale, timezone)}`
            : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-5 items-center rounded-md px-1.5 type-caption font-semibold ${statusTone(statusValue)}`}
        >
          {status}
        </span>
        <Link
          href={`/dashboard/clubs/${assignment.clubId}/assignments/${assignment.id}`}
          className="inline-flex h-8 items-center gap-1 rounded-[10px] border border-outline-variant px-2.5 type-caption font-semibold text-primary transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {actionLabel}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      {assignment.feedback || assignment.score != null ? (
        <div className="rounded-lg bg-success-container/45 px-3 py-2 type-caption text-on-success-container sm:basis-full">
          {assignment.score != null ? (
            <p className="font-semibold">
              {vi ? "Điểm" : "Score"}: {assignment.score}
              {assignment.scoreMax != null ? `/${assignment.scoreMax}` : ""}
            </p>
          ) : null}
          {assignment.feedback ? (
            <p className="mt-1 whitespace-pre-wrap">{assignment.feedback}</p>
          ) : null}
        </div>
      ) : null}
      {outcome ? (
        <div className="grid gap-2 rounded-lg border border-outline-variant bg-surface px-3 py-2 type-caption text-on-surface sm:basis-full sm:grid-cols-2">
          <div>
            <p className="font-semibold">
              {vi ? "Kết quả tức thì" : "Immediate outcomes"}
            </p>
            <p className="mt-1 text-on-surface-variant">
              {hasObjectiveOutcome
                ? [
                    outcome.readingBand != null
                      ? `${vi ? "Đọc" : "Reading"} ${outcome.readingBand}`
                      : null,
                    outcome.listeningBand != null
                      ? `${vi ? "Nghe" : "Listening"} ${outcome.listeningBand}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : vi
                  ? "Chưa có kết quả Đọc/Nghe"
                  : "No Reading/Listening result yet"}
            </p>
            {outcome.provisionalBand != null ? (
              <p className="mt-1 font-semibold text-warning">
                {vi ? "Tạm tính" : "Provisional"}: {outcome.provisionalBand}
              </p>
            ) : null}
          </div>
          <div>
            <p className="font-semibold">
              {vi ? "Phản hồi giáo viên" : "Teacher feedback"}
            </p>
            <p className="mt-1 text-on-surface-variant">
              {hasTeacherOutcome
                ? [
                    outcome.writingBand != null
                      ? `${vi ? "Viết" : "Writing"} ${outcome.writingBand}`
                      : null,
                    outcome.speakingBand != null
                      ? `${vi ? "Nói" : "Speaking"} ${outcome.speakingBand}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : vi
                  ? "Viết/Nói sẽ hiển thị sau khi giáo viên công bố."
                  : "Writing/Speaking appears after teacher publication."}
            </p>
            {outcome.officialOverallBand != null ? (
              <p className="mt-1 font-semibold text-success">
                {vi ? "Đã công bố" : "Published"}: {outcome.officialOverallBand}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function OccurrenceCard({
  occurrence,
  locale,
  materials,
}: {
  occurrence: StudentWeeklyOccurrence;
  locale: string;
  materials: LearnerMaterialProjection[];
}) {
  const vi = locale === "vi";
  const attendance = occurrence.attendance;
  return (
    <article className="rounded-[10px] border border-outline-variant bg-surface p-3 shadow-token-card">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 type-caption text-on-surface-variant">
            <span className="inline-flex items-center gap-1 font-semibold text-primary">
              <Clock3 className="size-3.5" aria-hidden="true" />
              {formatTime(occurrence.startsAt, locale, occurrence.timezone)}–
              {formatTime(occurrence.endsAt, locale, occurrence.timezone)}
            </span>
            <span aria-hidden="true">·</span>
            <span>{occurrence.timezone}</span>
            {attendance ? (
              <span
                className={`inline-flex h-5 items-center rounded-md px-1.5 font-semibold ${statusTone(attendance)}`}
              >
                {statusLabel(attendance, vi)}
              </span>
            ) : null}
          </div>
          <h3 className="mt-1.5 type-title-sm font-semibold text-on-surface">
            {occurrence.title}
          </h3>
          <p className="mt-0.5 type-body-sm text-on-surface-variant">
            {occurrence.classTitle} · {occurrence.courseTitle}
          </p>
          {occurrence.lessonTitle || occurrence.activityTitle ? (
            <p className="mt-1 type-caption text-on-surface-variant">
              {[occurrence.lessonTitle, occurrence.activityTitle]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {occurrence.notes ? (
            <p className="mt-2 rounded-[10px] bg-surface-container-low px-3 py-2 type-body-sm text-on-surface-variant">
              {occurrence.notes}
            </p>
          ) : null}
        </div>
        <span className="inline-flex h-5 shrink-0 items-center justify-center rounded-md border border-outline-variant px-1.5 type-caption font-semibold text-on-surface-variant">
          {vi ? "Lớp IELTS" : "IELTS class"}
        </span>
      </div>

      {materials.length ? (
        <div className="mt-4 border-t border-outline-variant pt-3">
          <LearnerMaterials materials={materials} locale={locale} compact />
        </div>
      ) : null}

      {occurrence.resources.length > 0 ? (
        <section
          className="mt-3 border-t border-outline-variant pt-2.5"
          aria-label={vi ? "Tài liệu" : "Resources"}
        >
          <div className="flex items-center gap-2 type-label font-semibold text-on-surface">
            <BookOpenText className="size-4 text-primary" aria-hidden="true" />
            {vi ? "Tài liệu" : "Resources"}
          </div>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {occurrence.resources.map((resource) => {
              const href = resource.signedUrl ?? resource.url;
              return (
                <li key={resource.id}>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-10 items-center justify-between gap-2 rounded-[10px] border border-outline-variant px-3 type-body-sm text-primary transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span className="min-w-0 truncate">{resource.title}</span>
                      <ExternalLink
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    </a>
                  ) : (
                    <span className="flex h-10 items-center rounded-[10px] border border-outline-variant px-3 type-body-sm text-on-surface-variant">
                      {resource.title}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {occurrence.assignments.length > 0 ? (
        <section
          className="mt-3 border-t border-outline-variant pt-2.5"
          aria-label={vi ? "Bài tập" : "Assignments"}
        >
          <div className="flex items-center gap-2 type-label font-semibold text-on-surface">
            <ClipboardList className="size-4 text-primary" aria-hidden="true" />
            {vi ? "Bài tập" : "Assignments"}
          </div>
          <ul className="mt-2 grid gap-2">
            {occurrence.assignments.map((assignment) => (
              <AssignmentRow
                key={assignment.id}
                assignment={assignment}
                locale={locale}
                timezone={occurrence.timezone}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

function EmptyState({ vi }: { vi: boolean }) {
  return (
    <div className="rounded-[10px] border border-dashed border-outline-variant bg-surface-container-low px-4 py-8 text-center">
      <CalendarDays
        className="mx-auto size-8 text-on-surface-variant"
        aria-hidden="true"
      />
      <p className="mt-3 type-body-sm font-semibold text-on-surface">
        {vi ? "Chưa có lớp trong tuần này" : "No classes this week"}
      </p>
      <p className="mt-1 type-caption text-on-surface-variant">
        {vi
          ? "Các buổi học và bài tập đã đăng sẽ xuất hiện tại đây."
          : "Published lessons and assignments will appear here."}
      </p>
    </div>
  );
}

export function StudentLmsWeek({
  data,
  locale,
  timezone,
  materialsByOccurrence = {},
  generalMaterials = [],
}: {
  data: StudentWeeklyLmsView;
  locale: string;
  timezone: string;
  materialsByOccurrence?: Record<string, LearnerMaterialProjection[]>;
  generalMaterials?: LearnerMaterialProjection[];
}) {
  const vi = locale === "vi";
  const dates = Array.from({ length: 7 }, (_, index) =>
    addDays(data.range.startDate, index),
  );
  const grouped = groupByDate(data.occurrences);
  const today = dateInTimezone(new Date(), timezone);
  const weekLabel = `${formatDate(data.range.startDate, locale, { month: "short", day: "numeric" })} – ${formatDate(data.range.endDate, locale, { month: "short", day: "numeric", year: "numeric" })}`;
  const weekQuery = (weekStart: string) =>
    `/ielts/classes?weekStart=${weekStart}`;
  const hasAnnouncements = data.announcements.length > 0;
  const hasNotifications = data.notifications.length > 0;
  const sortedOccurrences = [...data.occurrences].sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt),
  );
  const nextOccurrence =
    sortedOccurrences.find((occurrence) => occurrence.date >= today) ??
    sortedOccurrences[0];
  const outstandingAssignments = sortedOccurrences.flatMap((occurrence) =>
    occurrence.assignments
      .filter(
        (assignment) =>
          !assignment.submissionState ||
          assignment.gradeStatus === "resubmit_requested",
      )
      .map((assignment) => ({ assignment, occurrence })),
  );
  const nextAssignment = [...outstandingAssignments].sort((left, right) => {
    if (!left.assignment.dueAt) return 1;
    if (!right.assignment.dueAt) return -1;
    return left.assignment.dueAt.localeCompare(right.assignment.dueAt);
  })[0];

  return (
    <ProductPageShell>
      <PageContainer size="data" className="py-4 lg:py-5">
        <header className="flex flex-col gap-3 border-b border-outline-variant pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="type-label font-semibold uppercase tracking-widest text-primary">
              {vi ? "Không gian học IELTS" : "IELTS learner workspace"}
            </p>
            <h1 className="mt-1 type-heading-md font-semibold text-on-surface">
              {vi ? "Lịch học tuần này" : "My learning week"}
            </h1>
            <p className="mt-0.5 type-body-sm text-on-surface-variant">
              {vi
                ? "Xem lớp học, tài liệu, bài tập và nhận xét của giáo viên theo từng ngày."
                : "See classes, resources, assignments, and teacher feedback by lesson date."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={weekQuery(addDays(data.range.startDate, -7))}
              aria-label={vi ? "Tuần trước" : "Previous week"}
              className="inline-flex size-8 items-center justify-center rounded-[10px] border border-outline-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/ielts/classes"
              className="inline-flex h-8 items-center rounded-[10px] border border-outline-variant px-3 type-label font-semibold transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {vi ? "Hôm nay" : "Today"}
            </Link>
            <Link
              href={weekQuery(addDays(data.range.startDate, 7))}
              aria-label={vi ? "Tuần sau" : "Next week"}
              className="inline-flex size-8 items-center justify-center rounded-[10px] border border-outline-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </header>

        <section className="mt-4 grid gap-3 rounded-[10px] border border-outline-variant bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-on-primary">
              <ClipboardList className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="type-caption font-semibold uppercase tracking-wide text-on-surface-variant">
                {vi ? "Việc tiếp theo" : "Next action"}
              </p>
              <h2 className="mt-0.5 truncate type-title-sm font-semibold text-on-surface">
                {nextAssignment?.assignment.title ??
                  nextOccurrence?.title ??
                  (vi ? "Xem bài được giao" : "Review assigned work")}
              </h2>
              <p className="mt-0.5 type-body-sm text-on-surface-variant">
                {nextAssignment?.assignment.dueAt
                  ? `${vi ? "Hạn" : "Due"} ${formatDateTime(nextAssignment.assignment.dueAt, locale, timezone)} · ${nextAssignment.occurrence.classTitle}`
                  : nextOccurrence
                    ? `${formatDateTime(nextOccurrence.startsAt, locale, nextOccurrence.timezone)} · ${nextOccurrence.classTitle}`
                    : vi
                      ? "Tất cả bài tập và phản hồi ở một nơi."
                      : "Assignments and teacher feedback in one place."}
              </p>
            </div>
          </div>
          <Link
            href={
              nextAssignment
                ? `/dashboard/clubs/${nextAssignment.assignment.clubId}/assignments/${nextAssignment.assignment.id}`
                : "/ielts/assigned"
            }
            className="inline-flex h-8 items-center justify-center gap-2 rounded-[10px] bg-primary px-3 type-label font-semibold text-on-primary transition-colors hover:bg-primary-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {nextAssignment
              ? vi
                ? "Mở bài"
                : "Open work"
              : vi
                ? "Bài được giao"
                : "Assigned work"}
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Link>
        </section>

        {generalMaterials.length ? (
          <section
            className="mt-3 rounded-[10px] border border-outline-variant bg-surface p-3"
            aria-label={vi ? "Tài liệu lớp học" : "Class materials"}
          >
            <LearnerMaterials materials={generalMaterials} locale={locale} />
          </section>
        ) : null}

        <section className="mt-3" aria-labelledby="student-week-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2
                id="student-week-heading"
                className="type-title-sm font-semibold text-on-surface"
              >
                {vi ? "Tuần học" : "Learning week"}
              </h2>
              <p className="type-caption text-on-surface-variant">
                {weekLabel}
              </p>
            </div>
            <Link
              href="/ielts/assigned"
              className="type-label font-semibold text-primary focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {vi ? "Xem tất cả bài tập" : "View all assigned work"}
            </Link>
          </div>
          <div className="mt-2 overflow-x-auto pb-1">
            <ol className="grid min-w-[36rem] grid-cols-7 overflow-hidden rounded-[10px] border border-outline-variant bg-surface">
              {dates.map((date) => {
                const itemCount = (grouped.get(date) ?? []).length;
                const isToday = date === today;
                return (
                  <li
                    key={date}
                    aria-current={isToday ? "date" : undefined}
                    className={`min-h-11 border-l border-outline-variant px-2 py-2 first:border-l-0 ${isToday ? "bg-primary-container/45" : "bg-surface"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="type-caption font-semibold uppercase text-on-surface-variant">
                          {formatDate(date, locale, { weekday: "short" })}
                        </p>
                        <p className="type-label font-semibold text-on-surface">
                          {formatDate(date, locale, { day: "numeric" })}
                        </p>
                      </div>
                      {itemCount > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-surface-container-high px-1 type-caption font-semibold text-on-surface-variant">
                          {itemCount}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section
            className="grid content-start gap-2"
            aria-label={vi ? "Lịch học theo tuần" : "Weekly class schedule"}
          >
            {dates.map((date) => {
              const items = grouped.get(date) ?? [];
              const isToday = date === today;
              if (items.length === 0) return null;
              return (
                <div key={date} className="grid gap-2 lg:grid-cols-[8rem_1fr]">
                  <div
                    className={`rounded-[10px] border px-3 py-2 lg:self-start ${isToday ? "border-primary bg-primary-container/35" : "border-outline-variant bg-surface-container-low"}`}
                  >
                    <p className="type-label font-semibold uppercase text-on-surface-variant">
                      {formatDate(date, locale, { weekday: "long" })}
                    </p>
                    <p className="mt-0.5 type-title-sm font-semibold text-on-surface">
                      {formatDate(date, locale, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    {isToday ? (
                      <span className="mt-1 inline-flex h-5 items-center rounded-md bg-primary px-1.5 type-caption font-semibold text-on-primary">
                        {vi ? "Hôm nay" : "Today"}
                      </span>
                    ) : null}
                  </div>
                  <div className="grid gap-2">
                    {items.map((item) => (
                      <OccurrenceCard
                        key={item.id}
                        occurrence={item}
                        locale={locale}
                        materials={materialsByOccurrence[item.id] ?? []}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {data.occurrences.length === 0 ? <EmptyState vi={vi} /> : null}
          </section>
          <aside className="grid content-start gap-3">
            <section
              className="rounded-[10px] border border-outline-variant bg-surface p-3"
              aria-labelledby="student-announcements-heading"
            >
              <div className="flex items-center justify-between gap-3">
                <h2
                  id="student-announcements-heading"
                  className="flex items-center gap-2 type-heading-sm font-semibold text-on-surface"
                >
                  <MessageSquareText
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                  {vi ? "Thông báo lớp" : "Class announcements"}
                </h2>
              </div>
              {hasAnnouncements ? (
                <ul className="mt-2 divide-y divide-outline-variant">
                  {data.announcements.slice(0, 5).map((announcement) => (
                    <li
                      key={announcement.id}
                      className="py-2.5 first:pt-0 last:pb-0"
                    >
                      <p className="type-label font-semibold text-on-surface">
                        {announcement.title}
                      </p>
                      <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap type-body-sm text-on-surface-variant">
                        {announcement.body}
                      </p>
                      {announcement.publishedAt ? (
                        <p className="mt-1 type-caption text-on-surface-variant">
                          {formatDateTime(
                            announcement.publishedAt,
                            locale,
                            timezone,
                          )}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 type-body-sm text-on-surface-variant">
                  {vi ? "Chưa có thông báo mới." : "No announcements yet."}
                </p>
              )}
            </section>

            <section
              className="rounded-[10px] border border-outline-variant bg-surface p-3"
              aria-labelledby="student-notifications-heading"
            >
              <div className="flex items-center justify-between gap-3">
                <h2
                  id="student-notifications-heading"
                  className="flex items-center gap-2 type-heading-sm font-semibold text-on-surface"
                >
                  <BellRing
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                  {vi ? "Thông báo của bạn" : "Your notifications"}
                </h2>
                {data.unreadNotifications > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary px-1.5 type-caption font-semibold text-on-primary">
                    {data.unreadNotifications}
                  </span>
                ) : null}
              </div>
              {hasNotifications ? (
                <ul className="mt-2 divide-y divide-outline-variant">
                  {data.notifications.slice(0, 5).map((notification) => (
                    <li
                      key={notification.id}
                      className={`py-2.5 first:pt-0 last:pb-0 ${notification.readAt ? "" : "text-on-surface"}`}
                    >
                      <div className="flex items-start gap-2">
                        {!notification.readAt ? (
                          <CheckCircle2
                            className="mt-0.5 size-4 shrink-0 text-primary"
                            aria-label={vi ? "Chưa đọc" : "Unread"}
                          />
                        ) : null}
                        <div className="min-w-0">
                          <p className="type-label font-semibold text-on-surface">
                            {notification.title}
                          </p>
                          <p className="mt-0.5 line-clamp-3 type-body-sm text-on-surface-variant">
                            {notification.body}
                          </p>
                          <p className="mt-1 type-caption text-on-surface-variant">
                            {formatDateTime(
                              notification.createdAt,
                              locale,
                              timezone,
                            )}
                          </p>
                          {!notification.readAt ? (
                            <form
                              action={markNotificationRead.bind(
                                null,
                                notification.id,
                              )}
                              className="mt-1.5"
                            >
                              <button className="h-8 rounded-[10px] border border-outline-variant px-2.5 type-caption font-semibold text-primary transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                {vi ? "Đánh dấu đã đọc" : "Mark as read"}
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 type-body-sm text-on-surface-variant">
                  {vi ? "Bạn đã cập nhật." : "You’re all caught up."}
                </p>
              )}
            </section>
          </aside>
        </div>
      </PageContainer>
    </ProductPageShell>
  );
}
