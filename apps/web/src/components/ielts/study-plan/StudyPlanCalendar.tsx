import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
} from "@/components/ui/icons";
import type {
  IeltsStudyPlanItemView,
  IeltsStudyPlanPageView,
} from "@/lib/ielts/study-plan/page-view";
import { cn } from "@/lib/utils";
import {
  KindChip,
  SectionCard,
  SkillBadge,
  dayOfMonth,
  formatShortDate,
  pickText,
} from "./shared";

function TaskRow({ item }: { item: IeltsStudyPlanItemView }) {
  const t = useTranslations("ielts.studyPlan");
  const locale = useLocale();
  return (
    <li className="flex items-start justify-between gap-2 rounded-xl bg-surface px-3 py-2">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <KindChip kind={item.kind} />
          <SkillBadge skill={item.skill} />
          {item.isComplete ? (
            <CheckCircle2 className="size-4 text-success-dim" aria-label={t("done")} />
          ) : null}
        </div>
        <p className="mt-1 truncate type-body-sm font-semibold text-on-surface">
          {pickText(locale, item.titleEn, item.titleVi)}
        </p>
        <p className="line-clamp-2 type-caption text-on-surface-variant">
          {pickText(locale, item.rationaleEn, item.rationaleVi)}
        </p>
      </div>
      <span className="shrink-0 type-caption font-medium text-on-surface-variant">
        {t("minutes", { count: item.estimatedMinutes })}
      </span>
    </li>
  );
}

export function StudyPlanCalendar({ view }: { view: IeltsStudyPlanPageView }) {
  const t = useTranslations("ielts.studyPlan");
  const { calendar } = view;

  return (
    <SectionCard
      icon={CalendarDays}
      title={t("calendar_title")}
      caption={t("calendar_caption")}
      action={
        <span className="rounded-full bg-surface-container-high px-3 py-1 type-caption font-semibold text-on-surface-variant">
          {t("calendar_summary", {
            minutes: calendar.totalPlannedMinutes,
            items: calendar.totalItemCount,
          })}
        </span>
      }
    >
      <div className="grid gap-3">
        {calendar.overdue.length > 0 ? (
          <div className="rounded-2xl border border-warning bg-warning-container p-3">
            <p className="flex items-center gap-2 type-body-sm font-semibold text-on-warning-container">
              <AlertTriangle className="size-4" />
              {t("overdue_title")} ·{" "}
              {t("overdue_caption", { count: calendar.overdue.length })}
            </p>
            <ul className="mt-2 grid gap-2">
              {calendar.overdue.map((item) => (
                <TaskRow key={item.id} item={item} />
              ))}
            </ul>
          </div>
        ) : null}

        {calendar.days.map((day, index) => (
          <div key={day.date} className="grid gap-2">
            {index % 7 === 0 ? (
              <p className="pt-1 type-caption font-semibold uppercase text-on-surface-variant">
                {t("week", { index: Math.floor(index / 7) + 1 })}
              </p>
            ) : null}
            <div
              className={cn(
                "flex gap-3 rounded-2xl border p-3",
                day.isToday
                  ? "border-primary bg-primary-container"
                  : "border-outline-variant bg-surface-container-low",
              )}
            >
              <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-surface px-2 py-1 text-center">
                <span className="type-caption font-semibold uppercase text-on-surface-variant">
                  {t(`days.${day.isoWeekday}`)}
                </span>
                <span className="type-heading-sm font-bold tabular-nums text-on-surface">
                  {dayOfMonth(day.date)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                {day.isToday ? (
                  <span className="type-caption font-bold uppercase text-primary">
                    {t("today")}
                  </span>
                ) : null}
                {day.items.length === 0 ? (
                  <p className="type-body-sm text-on-surface-variant">
                    {day.isStudyDay ? t("free_day") : t("rest_day")}
                  </p>
                ) : (
                  <ul className="grid gap-2">
                    {day.items.map((item) => (
                      <TaskRow key={item.id} item={item} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export function StudyPlanForecast({ view }: { view: IeltsStudyPlanPageView }) {
  const t = useTranslations("ielts.studyPlan");
  const locale = useLocale();
  const weeks = view.weeklyForecast;
  if (weeks.length === 0) return null;

  return (
    <SectionCard
      icon={CalendarClock}
      title={t("forecast_title")}
      caption={t("forecast_caption")}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {weeks.map((week) => {
          const maxMinutes = Math.max(1, ...week.bySkill.map((entry) => entry.minutes));
          return (
            <div
              key={week.index}
              className="rounded-2xl border border-outline-variant bg-surface-container-low p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="type-body-sm font-bold text-on-surface">
                  {t("week", { index: week.index })}
                </p>
                <p className="type-caption text-on-surface-variant">
                  {formatShortDate(week.startDate, locale)} –{" "}
                  {formatShortDate(week.endDate, locale)}
                </p>
              </div>
              <p className="mt-1 type-caption text-on-surface-variant">
                {t("week_summary", {
                  minutes: week.plannedMinutes,
                  items: week.itemCount,
                  days: week.studyDayCount,
                })}
              </p>
              {week.bySkill.length > 0 ? (
                <div className="mt-3 grid gap-1.5">
                  {week.bySkill.map((entry) => (
                    <div key={entry.skill} className="flex items-center gap-2">
                      <SkillBadge skill={entry.skill} className="w-20 justify-center" />
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container-high">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(entry.minutes / maxMinutes) * 100}%` }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right type-caption tabular-nums text-on-surface-variant">
                        {t("minutes", { count: entry.minutes })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
