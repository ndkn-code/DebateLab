"use client";

import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
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

function activityLevel(day: IeltsConsistencyDayView): 0 | 1 | 2 | 3 {
  if (day.completedTasks >= 3 || day.completedMinutes >= 45) return 3;
  if (day.completedTasks >= 2 || day.completedMinutes >= 25) return 2;
  if (day.completedTasks >= 1 || day.completedMinutes > 0) return 1;
  return 0;
}

const LEVEL_CLASS = {
  0: "bg-surface-container-high text-on-surface-variant",
  1: "bg-success-container text-on-success-container",
  2: "bg-success/55 text-on-surface",
  3: "bg-success text-on-success",
} as const;

function HeatmapCell({
  day,
  locale,
}: {
  day: IeltsConsistencyDayView;
  locale: string;
}) {
  const copy = COPY[locale === "vi" ? "vi" : "en"];
  const level = activityLevel(day);
  const date = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${day.date}T12:00:00Z`));
  const label = interpolate(copy.day, {
    date,
    minutes: day.completedMinutes,
    tasks: day.completedTasks,
    planned: day.plannedMinutes,
  });
  return (
    <abbr
      aria-label={label}
      className={cn(
        "grid size-7 cursor-help place-items-center rounded-md border border-outline-variant type-caption font-semibold no-underline outline-none transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none sm:size-6",
        LEVEL_CLASS[level],
      )}
      tabIndex={day.completedTasks > 0 ? 0 : -1}
      title={label}
    >
      {day.completedTasks > 0 ? Math.min(day.completedTasks, 3) : ""}
      {day.completedTasks >= 3 ? <span className="sr-only">+</span> : null}
    </abbr>
  );
}

export function StudyConsistencyHeatmap({ view }: { view: IeltsProfileView }) {
  const locale = useLocale();
  const copy = COPY[locale === "vi" ? "vi" : "en"];
  const days = view.consistency.days;
  const activeDays = days.filter((day) => day.completedTasks > 0).length;
  const totalMinutes = days.reduce((sum, day) => sum + day.completedMinutes, 0);
  const totalTasks = days.reduce((sum, day) => sum + day.completedTasks, 0);

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

      <div
        className="mt-4 overflow-x-auto pb-2"
        role="group"
        aria-label={copy.title}
      >
        <div className="grid w-max grid-flow-col grid-rows-7 gap-1">
          {days.map((day) => (
            <HeatmapCell day={day} key={day.date} locale={locale} />
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 type-caption text-on-surface-variant">
        <span>{view.consistency.timezone}</span>
        <div
          className="flex items-center gap-1.5"
          aria-label={`${copy.less} – ${copy.more}`}
        >
          <span>{copy.less}</span>
          {copy.levels.map((label, index) => (
            <span
              aria-label={label}
              className={cn(
                "size-4 rounded border border-outline-variant",
                LEVEL_CLASS[index as 0 | 1 | 2 | 3],
              )}
              key={label}
              role="img"
            />
          ))}
          <span>{copy.more}</span>
        </div>
      </div>
    </section>
  );
}
