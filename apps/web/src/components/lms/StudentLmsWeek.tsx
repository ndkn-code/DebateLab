import { Link } from "@/i18n/navigation";
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

const DAY_MS = 86_400_000;

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

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
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
}: {
  assignment: StudentWeeklyAssignment;
  locale: string;
}) {
  const vi = locale === "vi";
  const submission = assignment.submissionState;
  const status = statusLabel(submission ?? assignment.gradeStatus, vi);

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-outline-variant bg-surface-container-low p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="type-label font-semibold text-on-surface">
          {assignment.title}
        </p>
        <p className="mt-1 type-caption text-on-surface-variant">
          {relationLabel(assignment.relationType, vi)}
          {assignment.dueAt
            ? ` · ${vi ? "Hạn" : "Due"} ${formatDateTime(assignment.dueAt, locale)}`
            : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-1 type-caption font-semibold ${statusTone(submission ?? assignment.gradeStatus)}`}
        >
          {status}
        </span>
        <Link
          href="/ielts/assigned"
          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-outline-variant px-2.5 type-caption font-semibold text-primary hover:bg-surface-container"
        >
          {vi ? "Mở" : "Open"}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </li>
  );
}

function OccurrenceCard({
  occurrence,
  locale,
}: {
  occurrence: StudentWeeklyOccurrence;
  locale: string;
}) {
  const vi = locale === "vi";
  const attendance = occurrence.attendance;
  return (
    <article className="rounded-xl border border-outline-variant bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 type-caption text-on-surface-variant">
            <span className="inline-flex items-center gap-1 font-semibold text-primary">
              <Clock3 className="size-3.5" aria-hidden="true" />
              {formatTime(occurrence.startsAt, locale)}–
              {formatTime(occurrence.endsAt, locale)}
            </span>
            <span aria-hidden="true">·</span>
            <span>{occurrence.timezone}</span>
            {attendance ? (
              <span
                className={`rounded-full px-2 py-0.5 font-semibold ${statusTone(attendance)}`}
              >
                {statusLabel(attendance, vi)}
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 type-heading-sm font-semibold text-on-surface">
            {occurrence.title}
          </h3>
          <p className="mt-1 type-body-sm text-on-surface-variant">
            {occurrence.classTitle} · {occurrence.courseTitle}
          </p>
          {occurrence.lessonTitle || occurrence.activityTitle ? (
            <p className="mt-2 type-caption text-on-surface-variant">
              {[occurrence.lessonTitle, occurrence.activityTitle]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {occurrence.notes ? (
            <p className="mt-3 rounded-lg bg-surface-container-low px-3 py-2 type-body-sm text-on-surface-variant">
              {occurrence.notes}
            </p>
          ) : null}
        </div>
        <span className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-outline-variant px-3 type-label font-semibold text-on-surface-variant">
          {vi ? "Lớp IELTS" : "IELTS class"}
        </span>
      </div>

      {occurrence.resources.length > 0 ? (
        <section
          className="mt-4 border-t border-outline-variant pt-3"
          aria-label={vi ? "Tài liệu" : "Resources"}
        >
          <div className="flex items-center gap-2 type-label font-semibold text-on-surface">
            <BookOpenText className="size-4 text-primary" aria-hidden="true" />
            {vi ? "Tài liệu" : "Resources"}
          </div>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {occurrence.resources.map((resource) => {
              const href = resource.signedUrl ?? resource.url;
              return (
                <li key={resource.id}>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-10 items-center justify-between gap-2 rounded-lg border border-outline-variant px-3 type-body-sm text-primary hover:bg-surface-container"
                    >
                      <span className="min-w-0 truncate">{resource.title}</span>
                      <ExternalLink
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    </a>
                  ) : (
                    <span className="flex min-h-10 items-center rounded-lg border border-outline-variant px-3 type-body-sm text-on-surface-variant">
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
          className="mt-4 border-t border-outline-variant pt-3"
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
    <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 py-10 text-center">
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
}: {
  data: StudentWeeklyLmsView;
  locale: string;
}) {
  const vi = locale === "vi";
  const dates = Array.from({ length: 7 }, (_, index) =>
    addDays(data.range.startDate, index),
  );
  const grouped = groupByDate(data.occurrences);
  const today = new Date().toISOString().slice(0, 10);
  const weekLabel = `${formatDate(data.range.startDate, locale, { month: "short", day: "numeric" })} – ${formatDate(data.range.endDate, locale, { month: "short", day: "numeric", year: "numeric" })}`;
  const weekQuery = (weekStart: string) =>
    `/ielts/classes?weekStart=${weekStart}`;
  const hasAnnouncements = data.announcements.length > 0;
  const hasNotifications = data.notifications.length > 0;

  return (
    <ProductPageShell>
      <PageContainer size="wide" className="py-5 lg:py-8">
        <header className="flex flex-col gap-4 border-b border-outline-variant pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="type-label font-semibold uppercase tracking-widest text-primary">
              {vi ? "Không gian học IELTS" : "IELTS learner workspace"}
            </p>
            <h1 className="mt-1 type-heading-lg font-semibold text-on-surface">
              {vi ? "Lịch học tuần này" : "My learning week"}
            </h1>
            <p className="mt-1 type-body-sm text-on-surface-variant">
              {vi
                ? "Xem lớp học, tài liệu, bài tập và nhận xét của giáo viên theo từng ngày."
                : "See classes, resources, assignments, and teacher feedback by lesson date."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={weekQuery(addDays(data.range.startDate, -7))}
              aria-label={vi ? "Tuần trước" : "Previous week"}
              className="inline-flex size-10 items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/ielts/classes"
              className="inline-flex min-h-10 items-center rounded-lg border border-outline-variant px-3 type-label font-semibold hover:bg-surface-container"
            >
              {vi ? "Hôm nay" : "Today"}
            </Link>
            <Link
              href={weekQuery(addDays(data.range.startDate, 7))}
              aria-label={vi ? "Tuần sau" : "Next week"}
              className="inline-flex size-10 items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </header>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="type-body-sm font-semibold text-on-surface">
            {weekLabel}
          </p>
          <Link
            href="/ielts/assigned"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 type-label font-semibold text-on-primary hover:opacity-90"
          >
            <ClipboardList className="size-4" aria-hidden="true" />
            {vi ? "Bài được giao" : "Assigned work"}
          </Link>
        </div>

        <section
          className="mt-4 grid gap-3"
          aria-label={vi ? "Lịch học theo tuần" : "Weekly class schedule"}
        >
          {dates.map((date) => {
            const items = grouped.get(date) ?? [];
            const isToday = date === today;
            return (
              <div key={date} className="grid gap-3 lg:grid-cols-[10rem_1fr]">
                <div
                  className={`rounded-xl border p-3 lg:self-start ${isToday ? "border-primary bg-primary-container/35" : "border-outline-variant bg-surface-container-low"}`}
                >
                  <p className="type-label font-semibold uppercase text-on-surface-variant">
                    {formatDate(date, locale, { weekday: "long" })}
                  </p>
                  <p className="mt-1 type-heading-sm font-semibold text-on-surface">
                    {formatDate(date, locale, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  {isToday ? (
                    <span className="mt-2 inline-flex rounded-full bg-primary px-2 py-0.5 type-caption font-semibold text-on-primary">
                      {vi ? "Hôm nay" : "Today"}
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-3">
                  {items.length > 0 ? (
                    items.map((item) => (
                      <OccurrenceCard
                        key={item.id}
                        occurrence={item}
                        locale={locale}
                      />
                    ))
                  ) : (
                    <EmptyState vi={vi} />
                  )}
                </div>
              </div>
            );
          })}
        </section>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <section
            className="rounded-xl border border-outline-variant bg-surface p-4"
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
              <ul className="mt-3 grid gap-3">
                {data.announcements.slice(0, 5).map((announcement) => (
                  <li
                    key={announcement.id}
                    className="border-t border-outline-variant pt-3 first:border-t-0 first:pt-0"
                  >
                    <p className="type-label font-semibold text-on-surface">
                      {announcement.title}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap type-body-sm text-on-surface-variant">
                      {announcement.body}
                    </p>
                    {announcement.publishedAt ? (
                      <p className="mt-2 type-caption text-on-surface-variant">
                        {formatDateTime(announcement.publishedAt, locale)}
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
            className="rounded-xl border border-outline-variant bg-surface p-4"
            aria-labelledby="student-notifications-heading"
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                id="student-notifications-heading"
                className="flex items-center gap-2 type-heading-sm font-semibold text-on-surface"
              >
                <BellRing className="size-4 text-primary" aria-hidden="true" />
                {vi ? "Thông báo của bạn" : "Your notifications"}
              </h2>
              {data.unreadNotifications > 0 ? (
                <span className="rounded-full bg-primary px-2 py-0.5 type-caption font-semibold text-on-primary">
                  {data.unreadNotifications}
                </span>
              ) : null}
            </div>
            {hasNotifications ? (
              <ul className="mt-3 grid gap-2">
                {data.notifications.slice(0, 5).map((notification) => (
                  <li
                    key={notification.id}
                    className={`rounded-lg border p-3 ${notification.readAt ? "border-outline-variant bg-surface-container-low" : "border-primary/40 bg-primary-container/30"}`}
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
                        <p className="mt-1 type-body-sm text-on-surface-variant">
                          {notification.body}
                        </p>
                        <p className="mt-2 type-caption text-on-surface-variant">
                          {formatDateTime(notification.createdAt, locale)}
                        </p>
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
        </div>
      </PageContainer>
    </ProductPageShell>
  );
}
