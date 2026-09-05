import { Link } from "@/i18n/navigation";
import { ClipboardList, ExternalLink } from "@/components/ui/icons";
import type { StudentAssignmentSummary } from "@/lib/api/class-lms/student-assignments-model";

function formatDueAt(value: string, locale: string, timezone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export function assignedWorkStatusLabel(
  state: StudentAssignmentSummary["state"],
  vi: boolean,
) {
  if (state === "not_started") return vi ? "Chưa nộp" : "Not submitted";
  if (state === "in_progress") return vi ? "Đang nộp dở" : "Upload unfinished";
  if (state === "submitted") return vi ? "Đã nộp" : "Submitted";
  if (state === "graded") return vi ? "Đã chấm" : "Graded";
  if (state === "returned") return vi ? "Đã trả bài" : "Feedback ready";
  return vi ? "Cần nộp lại" : "Resubmit requested";
}

function assignedWorkTone(state: StudentAssignmentSummary["state"]) {
  if (state === "graded" || state === "returned") {
    return "bg-success-container text-on-success-container";
  }
  if (state === "resubmit_requested" || state === "in_progress") {
    return "bg-error-container text-on-error-container";
  }
  return "bg-surface-container-high text-on-surface-variant";
}

function actionLabel(state: StudentAssignmentSummary["state"], vi: boolean) {
  if (state === "resubmit_requested") return vi ? "Nộp lại" : "Resubmit";
  if (state === "not_started") return vi ? "Bắt đầu" : "Start";
  if (state === "in_progress") return vi ? "Tiếp tục" : "Continue";
  return vi ? "Xem bài" : "View submission";
}

/**
 * One row of assigned work. Rendered from the occurrence-independent list, so it
 * appears whether or not a teacher ever attached the assignment to a scheduled
 * lesson.
 */
export function AssignedWorkRow({
  work,
  locale,
  timezone,
}: {
  work: StudentAssignmentSummary;
  locale: string;
  timezone: string;
}) {
  const vi = locale === "vi";

  return (
    <li className="flex min-h-11 flex-col gap-2 rounded-control border border-outline-variant bg-surface-container-low px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="type-label font-semibold text-on-surface">{work.title}</p>
        <p className="mt-0.5 type-caption text-on-surface-variant">
          {work.classTitle ? `${work.classTitle} · ` : ""}
          {work.dueAt
            ? `${vi ? "Hạn" : "Due"} ${formatDueAt(work.dueAt, locale, timezone)}`
            : vi
              ? "Không có hạn nộp"
              : "No due date"}
        </p>
        {work.overdue && work.outstanding ? (
          <p className="mt-0.5 type-caption font-semibold text-error">
            {vi
              ? "Đã quá hạn — nhờ giáo viên mở lại để nộp."
              : "Past due — ask your teacher to reopen it."}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-5 items-center rounded-md px-1.5 type-caption font-semibold ${assignedWorkTone(work.state)}`}
        >
          {assignedWorkStatusLabel(work.state, vi)}
        </span>
        <Link
          href={work.href}
          className="inline-flex h-8 items-center gap-1 rounded-control border border-outline-variant px-2.5 type-caption font-semibold text-primary transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {actionLabel(work.state, vi)}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      {work.feedback || work.score != null ? (
        <div className="rounded-lg bg-success-container px-3 py-2 type-caption text-on-success-container sm:basis-full">
          {work.score != null ? (
            <p className="font-semibold">
              {vi ? "Điểm" : "Score"}: {work.score}
              {work.scoreMax != null ? `/${work.scoreMax}` : ""}
            </p>
          ) : null}
          {work.feedback ? (
            <p className="mt-1 whitespace-pre-wrap">{work.feedback}</p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function AssignedWorkList({
  work,
  locale,
  timezone,
  heading,
  description,
  emptyTitle,
  emptyBody,
  outstandingCount,
  className,
  headingId = "assigned-work-heading",
}: {
  work: StudentAssignmentSummary[];
  locale: string;
  timezone: string;
  heading: string;
  description?: string;
  emptyTitle: string;
  emptyBody: string;
  outstandingCount?: number;
  className?: string;
  headingId?: string;
}) {
  const vi = locale === "vi";

  return (
    <section
      className={
        className ??
        "rounded-control border border-outline-variant bg-surface p-3"
      }
      aria-labelledby={headingId}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="type-body font-semibold text-on-surface">
          {heading}
        </h2>
        {outstandingCount ? (
          <span className="inline-flex h-5 items-center rounded-md bg-primary-container px-1.5 type-caption font-semibold text-on-primary-container">
            {vi ? `${outstandingCount} việc cần làm` : `${outstandingCount} to do`}
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="mt-0.5 type-caption text-on-surface-variant">
          {description}
        </p>
      ) : null}
      {work.length ? (
        <ul className="mt-2 grid gap-2">
          {work.map((item) => (
            <AssignedWorkRow
              key={item.id}
              work={item}
              locale={locale}
              timezone={timezone}
            />
          ))}
        </ul>
      ) : (
        <div className="mt-2 rounded-control border border-dashed border-outline-variant bg-surface-container-low px-4 py-6 text-center">
          <ClipboardList
            className="mx-auto size-6 text-on-surface-variant"
            aria-hidden="true"
          />
          <p className="mt-2 type-body-sm font-semibold text-on-surface">
            {emptyTitle}
          </p>
          <p className="mt-1 type-caption text-on-surface-variant">{emptyBody}</p>
        </div>
      )}
    </section>
  );
}
