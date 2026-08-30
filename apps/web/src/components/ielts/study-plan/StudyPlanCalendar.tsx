import { useLocale, useTranslations } from "next-intl";
import { useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
} from "@/components/ui/icons";
import {
  Area,
  AreaChart,
  ChartTooltip,
  Grid,
  XAxis,
} from "@/components/charts";
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

type ForecastDayDatum = {
  date: Date;
  label: string;
  plannedMinutes: number;
  completedMinutes: number;
  itemCount: number;
};

function ForecastTooltip({
  point,
  locale,
}: {
  point: Record<string, unknown>;
  locale: string;
}) {
  const label = typeof point.label === "string" ? point.label : "";
  const plannedMinutes =
    typeof point.plannedMinutes === "number" ? point.plannedMinutes : 0;
  const completedMinutes =
    typeof point.completedMinutes === "number" ? point.completedMinutes : 0;
  const itemCount = typeof point.itemCount === "number" ? point.itemCount : 0;
  const plannedLabel = locale === "vi" ? "phút dự kiến" : "planned minutes";
  const completedLabel = locale === "vi" ? "đã hoàn thành" : "completed";
  const tasksLabel = locale === "vi" ? "bài" : "tasks";

  return (
    <div className="min-w-40 px-3 py-2.5">
      <p className="type-caption font-semibold uppercase text-chart-tooltip-muted">
        {label}
      </p>
      <p className="mt-1 type-body-sm font-semibold text-chart-tooltip-foreground">
        {plannedMinutes} {plannedLabel}
      </p>
      <p className="mt-1 type-caption text-chart-tooltip-muted">
        {completedMinutes} {completedLabel} · {itemCount} {tasksLabel}
      </p>
    </div>
  );
}

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
            <CheckCircle2
              className="size-4 text-success-dim"
              aria-label={t("done")}
            />
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
          <div className="rounded-lg border border-warning bg-warning-container p-3">
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
                "flex gap-3 rounded-lg border p-3",
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
  const reduceMotion = useReducedMotion();
  const weeks = view.weeklyForecast;
  if (weeks.length === 0) return null;
  const forecastDays: ForecastDayDatum[] = view.calendar.days
    .slice(0, 14)
    .map((day) => ({
      date: new Date(`${day.date}T00:00:00.000Z`),
      label: formatShortDate(day.date, locale),
      plannedMinutes: day.plannedMinutes,
      completedMinutes: day.completedMinutes,
      itemCount: day.items.length,
    }));
  const totalPlanned = forecastDays.reduce(
    (sum, day) => sum + day.plannedMinutes,
    0,
  );
  const totalCompleted = forecastDays.reduce(
    (sum, day) => sum + day.completedMinutes,
    0,
  );
  const summary =
    locale === "vi"
      ? `Trong 14 ngày: ${totalPlanned} phút dự kiến, ${totalCompleted} phút hoàn thành.`
      : `Over 14 days: ${totalPlanned} planned minutes and ${totalCompleted} completed minutes.`;
  const plannedLabel = locale === "vi" ? "Dự kiến" : "Planned";
  const completedLabel = locale === "vi" ? "Hoàn thành" : "Completed";

  return (
    <SectionCard
      icon={CalendarClock}
      title={t("forecast_title")}
      caption={t("forecast_caption")}
    >
      <div className="grid gap-5">
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="type-caption text-on-surface-variant">{summary}</p>
            <div
              aria-label={`${plannedLabel}; ${completedLabel}`}
              className="flex items-center gap-3 type-caption text-on-surface-variant"
            >
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-0.5 w-5 bg-[var(--chart-line-primary)]"
                  aria-hidden
                />
                {plannedLabel}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-5 border-t-2 border-dashed border-[var(--chart-line-secondary)]"
                  aria-hidden
                />
                {completedLabel}
              </span>
            </div>
          </div>
          <div className="hidden h-64 sm:block" role="img" aria-label={summary}>
            <AreaChart
              animationDuration={reduceMotion ? 0 : 600}
              aspectRatio="unset"
              data={forecastDays}
              margin={{ top: 16, right: 18, bottom: 34, left: 42 }}
              style={{ height: "100%" }}
            >
              <Grid horizontal />
              <Area
                dataKey="plannedMinutes"
                fill="var(--chart-line-primary)"
                fillOpacity={0.12}
                showMarkers
                stroke="var(--chart-line-primary)"
                strokeWidth={2.5}
              />
              <Area
                dashFromIndex={0}
                dataKey="completedMinutes"
                fill="var(--chart-line-secondary)"
                fillOpacity={0}
                showMarkers
                stroke="var(--chart-line-secondary)"
                strokeWidth={2}
              />
              <XAxis />
              <ChartTooltip
                content={({ point }) => (
                  <ForecastTooltip locale={locale} point={point} />
                )}
                showDatePill={false}
              />
            </AreaChart>
          </div>
          <table className="mt-3 w-full table-fixed border-collapse type-caption sm:sr-only">
            <caption className="sr-only">{summary}</caption>
            <thead>
              <tr>
                <th className="border-b border-outline-variant px-2 py-2 text-left font-semibold text-on-surface-variant">
                  {locale === "vi" ? "Ngày" : "Date"}
                </th>
                <th className="border-b border-outline-variant px-2 py-2 text-right font-semibold text-on-surface-variant">
                  {plannedLabel}
                </th>
                <th className="border-b border-outline-variant px-2 py-2 text-right font-semibold text-on-surface-variant">
                  {completedLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {forecastDays.map((day) => (
                <tr key={day.label}>
                  <th className="border-b border-outline-variant px-2 py-2 text-left font-medium text-on-surface">
                    {day.label}
                  </th>
                  <td className="border-b border-outline-variant px-2 py-2 text-right tabular-nums text-on-surface">
                    {day.plannedMinutes}
                  </td>
                  <td className="border-b border-outline-variant px-2 py-2 text-right tabular-nums text-on-surface">
                    {day.completedMinutes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {weeks.map((week) => {
            return (
              <div
                key={week.index}
                className="rounded-lg border border-outline-variant bg-surface-container-low p-3"
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
                  <dl className="mt-3 grid gap-1.5">
                    {week.bySkill.map((entry) => (
                      <div
                        className="flex min-h-8 items-center justify-between gap-3 rounded-md bg-surface px-2.5 py-1.5"
                        key={entry.skill}
                      >
                        <dt className="type-caption font-medium text-on-surface-variant">
                          {t(`skills.${entry.skill}`)}
                        </dt>
                        <dd className="type-label font-semibold tabular-nums text-on-surface">
                          {t("minutes", { count: entry.minutes })}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}
