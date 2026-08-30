"use client";

import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  CalendarClock,
  CheckCircle2,
  MessageSquareText,
} from "@/components/ui/icons";
import type {
  IeltsProfileAttemptView,
  IeltsProfileView,
  IeltsTeacherFeedbackView,
} from "./types";

const COPY = {
  en: {
    ai: "AI provisional",
    teacher: "Teacher confirmed",
    objective: "Objective score",
    unknown: "Score source unavailable",
    recent: "Recent attempts",
    noAttempts:
      "No attempts yet. Your first completed practice will appear here.",
    inProgress: "In progress",
    review: "Review",
    feedback: "Teacher feedback",
    feedbackCaption: "Only feedback your teacher has published is shown here.",
    noFeedback: "No published teacher feedback yet.",
    writing: "Writing",
    speaking: "Speaking",
    task: "Task",
    part: "Part",
  },
  vi: {
    ai: "AI tạm tính",
    teacher: "Giáo viên xác nhận",
    objective: "Điểm khách quan",
    unknown: "Chưa có nguồn điểm",
    recent: "Lần làm gần đây",
    noAttempts:
      "Chưa có lần làm bài. Bài luyện tập hoàn thành đầu tiên sẽ hiện ở đây.",
    inProgress: "Đang làm",
    review: "Xem lại",
    feedback: "Nhận xét của giáo viên",
    feedbackCaption: "Chỉ nhận xét giáo viên đã công bố mới xuất hiện tại đây.",
    noFeedback: "Chưa có nhận xét nào được giáo viên công bố.",
    writing: "Viết",
    speaking: "Nói",
    task: "Bài",
    part: "Phần",
  },
} as const;

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function sourceLabel(
  source: IeltsProfileAttemptView["scoreSource"],
  locale: string,
) {
  const copy = COPY[locale === "vi" ? "vi" : "en"];
  if (source === "teacher_confirmed") return copy.teacher;
  if (source === "objective") return copy.objective;
  if (source === "ai_provisional") return copy.ai;
  return copy.unknown;
}

function AttemptRow({
  attempt,
  locale,
}: {
  attempt: IeltsProfileAttemptView;
  locale: string;
}) {
  const copy = COPY[locale === "vi" ? "vi" : "en"];
  const complete = attempt.status !== "in_progress";
  return (
    <li className="flex min-h-11 items-center justify-between gap-3 border-b border-outline-variant px-3 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate type-label font-semibold text-on-surface">
          {attempt.testTitle}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 type-caption text-on-surface-variant">
          <span>{sourceLabel(attempt.scoreSource, locale)}</span>
          {attempt.submittedAt ? (
            <span>{formatDate(attempt.submittedAt, locale)}</span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="rounded-md bg-surface-container-high px-2 py-1 type-label font-semibold tabular-nums text-on-surface">
          {complete
            ? attempt.band === null
              ? "—"
              : attempt.band.toFixed(1)
            : copy.inProgress}
        </span>
        {complete ? (
          <Link
            className="type-label font-semibold text-primary hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={attempt.resultsHref}
          >
            {copy.review}
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function FeedbackRow({
  item,
  locale,
}: {
  item: IeltsTeacherFeedbackView;
  locale: string;
}) {
  const copy = COPY[locale === "vi" ? "vi" : "en"];
  const taskLabel = item.taskLabel
    ? `${item.skill === "writing" ? copy.task : copy.part} ${item.taskLabel}`
    : copy.speaking;
  return (
    <li className="border-b border-outline-variant px-3 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-label font-semibold text-on-surface">
          {item.testTitle} · {copy[item.skill]} {taskLabel}
        </p>
        <span className="inline-flex items-center gap-1 rounded-md bg-success-container px-2 py-1 type-caption font-semibold text-on-success-container">
          <CheckCircle2 className="size-3.5" aria-hidden />
          {copy.teacher}
        </span>
      </div>
      <p className="mt-2 line-clamp-3 type-body-sm text-on-surface-variant">
        {item.note}
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="type-caption text-on-surface-variant">
          {item.submittedAt ? formatDate(item.submittedAt, locale) : ""}
        </span>
        <Link
          className="type-label font-semibold text-primary hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={item.resultsHref}
        >
          {copy.review}
        </Link>
      </div>
    </li>
  );
}

export function ProfileEvidenceLists({ view }: { view: IeltsProfileView }) {
  const locale = useLocale();
  const copy = COPY[locale === "vi" ? "vi" : "en"];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section
        aria-labelledby="ielts-profile-attempts"
        className="rounded-xl border border-outline-variant bg-surface-container p-4"
      >
        <h2
          id="ielts-profile-attempts"
          className="flex items-center gap-2 type-heading-md font-semibold text-on-surface"
        >
          <CalendarClock className="size-5 text-primary" aria-hidden />
          {copy.recent}
        </h2>
        {view.recentAttempts.length > 0 ? (
          <ul className="mt-3 overflow-hidden rounded-lg border border-outline-variant bg-surface">
            {view.recentAttempts.map((attempt) => (
              <AttemptRow
                attempt={attempt}
                key={attempt.attemptId}
                locale={locale}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-lg bg-surface px-3 py-4 type-body-sm text-on-surface-variant">
            {copy.noAttempts}
          </p>
        )}
      </section>
      <section
        aria-labelledby="ielts-profile-feedback"
        className="rounded-xl border border-outline-variant bg-surface-container p-4"
      >
        <h2
          id="ielts-profile-feedback"
          className="flex items-center gap-2 type-heading-md font-semibold text-on-surface"
        >
          <MessageSquareText className="size-5 text-primary" aria-hidden />
          {copy.feedback}
        </h2>
        <p className="mt-1 type-body-sm text-on-surface-variant">
          {copy.feedbackCaption}
        </p>
        {view.teacherFeedback.length > 0 ? (
          <ul className="mt-3 overflow-hidden rounded-lg border border-outline-variant bg-surface">
            {view.teacherFeedback.map((item) => (
              <FeedbackRow item={item} key={item.id} locale={locale} />
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-lg bg-surface px-3 py-4 type-body-sm text-on-surface-variant">
            {copy.noFeedback}
          </p>
        )}
      </section>
    </div>
  );
}
