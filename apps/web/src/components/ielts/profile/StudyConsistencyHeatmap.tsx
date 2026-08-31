"use client";

import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "@/components/ui/icons";
import GitHubActivity, {
  type Contribution,
} from "@/components/ui/github-activity";
import type { IeltsConsistencyDayView, IeltsProfileView } from "./types";

const COPY = {
  en: {
    title: "Study consistency",
    caption:
      "Current-plan tasks completed in the recent 12-week window. Minutes are task estimates, not measured study time.",
    viewPlan: "View plan",
    streak: "{value}-day streak",
    longest: "Longest {value} days",
    activeDays: "{value} active days",
    totalMinutes: "{value} estimated min",
    summary:
      "In the current plan's recent window: {days} active days, {tasks} completed tasks, {minutes} estimated minutes.",
    empty: "No IELTS plan tasks completed in this period yet.",
    day: "{date}: {tasks} completed tasks representing {minutes} estimated minutes; {planned} planned minutes.",
    less: "Less",
    more: "More",
    levels: ["No activity", "1 task", "2 tasks", "3 or more tasks"],
  },
  vi: {
    title: "Nhịp học tập",
    caption:
      "Bài trong kế hoạch hiện tại đã hoàn thành trong 12 tuần gần đây. Số phút là ước tính của bài, không phải thời gian học đo được.",
    viewPlan: "Xem kế hoạch",
    streak: "Chuỗi {value} ngày",
    longest: "Dài nhất {value} ngày",
    activeDays: "{value} ngày học",
    totalMinutes: "{value} phút ước tính",
    summary:
      "Trong giai đoạn gần đây của kế hoạch hiện tại: {days} ngày học, {tasks} bài hoàn thành, {minutes} phút ước tính.",
    empty:
      "Chưa có bài IELTS nào trong kế hoạch được hoàn thành trong giai đoạn này.",
    day: "{date}: {tasks} bài hoàn thành tương ứng {minutes} phút ước tính; {planned} phút dự kiến.",
    less: "Ít",
    more: "Nhiều",
    levels: ["Không hoạt động", "1 bài", "2 bài", "Từ 3 bài"],
  },
} as const;

function interpolate(
  template: string,
  values: Record<string, string | number>,
) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}

function activityLevel(day: IeltsConsistencyDayView): 0 | 1 | 2 | 3 | 4 {
  if (day.completedTasks >= 4 || day.completedMinutes >= 60) return 4;
  if (day.completedTasks >= 3 || day.completedMinutes >= 45) return 3;
  if (day.completedTasks >= 2 || day.completedMinutes >= 25) return 2;
  if (day.completedTasks >= 1 || day.completedMinutes > 0) return 1;
  return 0;
}

function alignContributionsToSunday(
  contributions: Contribution[],
): Contribution[] {
  const firstDate = contributions[0]?.date;
  if (!firstDate) return contributions;

  const firstDay = new Date(`${firstDate}T00:00:00Z`).getUTCDay();
  if (firstDay === 0) return contributions;

  const padding = Array.from({ length: firstDay }, (_, index) => {
    const date = new Date(`${firstDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (firstDay - index));
    return {
      date: date.toISOString().slice(0, 10),
      count: 0,
      level: 0 as const,
    };
  });

  return [...padding, ...contributions];
}

export function StudyConsistencyHeatmap({ view }: { view: IeltsProfileView }) {
  const locale = useLocale();
  const copy = COPY[locale === "vi" ? "vi" : "en"];
  const days = view.consistency.days;
  const activeDays = days.filter((day) => day.completedTasks > 0).length;
  const totalMinutes = days.reduce((sum, day) => sum + day.completedMinutes, 0);
  const totalTasks = days.reduce((sum, day) => sum + day.completedTasks, 0);
  const contributions = alignContributionsToSunday(
    days.map((day) => ({
      date: day.date,
      count: day.completedTasks,
      level: activityLevel(day),
    })),
  );
  const dateFormatter = new Intl.DateTimeFormat(
    locale === "vi" ? "vi-VN" : "en-GB",
    { day: "numeric", month: "short", year: "numeric" },
  );

  return (
    <section
      aria-labelledby="ielts-profile-consistency"
      className="rounded-xl border border-outline-variant bg-surface-container p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="ielts-profile-consistency"
            className="type-heading-md font-semibold text-on-surface"
          >
            {copy.title}
          </h2>
          <p className="mt-1 type-body-sm text-on-surface-variant">
            {copy.caption}
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-1 type-label font-semibold text-primary hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href="/ielts/study-plan"
        >
          {copy.viewPlan}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 type-caption text-on-surface-variant">
        <span className="font-semibold text-on-surface">
          {interpolate(copy.streak, { value: view.consistency.currentStreak })}
        </span>
        <span>
          {interpolate(copy.longest, { value: view.consistency.longestStreak })}
        </span>
        <span>{interpolate(copy.activeDays, { value: activeDays })}</span>
        <span>{interpolate(copy.totalMinutes, { value: totalMinutes })}</span>
      </div>
      <p className="sr-only">
        {interpolate(copy.summary, {
          days: activeDays,
          tasks: totalTasks,
          minutes: totalMinutes,
        })}
      </p>
      {activeDays === 0 ? (
        <p className="mt-4 rounded-lg bg-surface px-3 py-3 type-body-sm text-on-surface-variant">
          {copy.empty}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto pb-2">
        <GitHubActivity
          aria-hidden="true"
          className="[&>p:first-child]:hidden"
          contributions={contributions}
          repos={[]}
          year={Number(days.at(-1)?.date.slice(0, 4)) || undefined}
          accent="var(--success)"
          months={Math.max(1, Math.ceil(days.length / 28))}
          showMonths
          label={copy.title}
        />
      </div>
      <ul className="sr-only">
        {days.map((day) => (
          <li key={day.date}>
            {interpolate(copy.day, {
              date: dateFormatter.format(new Date(`${day.date}T12:00:00Z`)),
              tasks: day.completedTasks,
              minutes: day.completedMinutes,
              planned: day.plannedMinutes,
            })}
          </li>
        ))}
      </ul>
      <p className="mt-2 type-caption text-on-surface-variant">
        {view.consistency.timezone}
      </p>
    </section>
  );
}
