import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
} from "@/components/ui/icons";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  BarYAxis,
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

type ForecastSkillDatum = {
  label: string;
  minutes: number;
};

function ForecastTooltip({ point }: { point: Record<string, unknown> }) {
  const label = typeof point.label === "string" ? point.label : "";
  const plannedMinutes =
    typeof point.plannedMinutes === "number" ? point.plannedMinutes : 0;
  const completedMinutes =
    typeof point.completedMinutes === "number" ? point.completedMinutes : 0;
  const itemCount = typeof point.itemCount === "number" ? point.itemCount : 0;

  return (
    <div className="min-w-40 px-3 py-2.5">
      <p className="type-caption font-semibold uppercase text-chart-tooltip-muted">
        {label}
      </p>
      <p className="mt-1 type-body-sm font-semibold text-chart-tooltip-foreground">
        {plannedMinutes} planned minutes
      </p>
      <p className="mt-1 type-caption text-chart-tooltip-muted">
        {completedMinutes} completed · {itemCount} tasks
      </p>
    </div>
  );
}

function SkillMinutesTooltip({ point }: { point: Record<string, unknown> }) {
  const label = typeof point.label === "string" ? point.label : "";
  const minutes = typeof point.minutes === "number" ? point.minutes : 0;

  return (
    <div className="min-w-36 px-3 py-2.5">
      <p className="type-caption font-semibold uppercase text-chart-tooltip-muted">
        {label}
      </p>
      <p className="mt-1 type-body-sm font-semibold text-chart-tooltip-foreground">
        {minutes} minutes
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
  const forecastDays: ForecastDayDatum[] = view.calendar.days
    .slice(0, 14)
    .map((day) => ({
      date: new Date(`${day.date}T00:00:00.000Z`),
      label: formatShortDate(day.date, locale),
      plannedMinutes: day.plannedMinutes,
      completedMinutes: day.completedMinutes,
      itemCount: day.items.length,
    }));

  return (
    <SectionCard
      icon={CalendarClock}
      title={t("forecast_title")}
      caption={t("forecast_caption")}
    >
      <div className="grid gap-5">
        <div className="h-64">
          <AreaChart
            aspectRatio="unset"
            data={forecastDays}
            margin={{ top: 16, right: 18, bottom: 34, left: 42 }}
            style={{ height: "100%" }}
          >
            <Grid horizontal />
            <Area
              dataKey="plannedMinutes"
              fill="var(--chart-line-primary)"
              fillOpacity={0.28}
              showMarkers
              stroke="var(--chart-line-primary)"
              strokeWidth={2.5}
            />
            <Area
              dataKey="completedMinutes"
              fill="var(--chart-line-secondary)"
              fillOpacity={0.22}
              showMarkers
              stroke="var(--chart-line-secondary)"
              strokeWidth={2}
            />
            <XAxis />
            <ChartTooltip
              content={({ point }) => <ForecastTooltip point={point} />}
              showDatePill={false}
            />
          </AreaChart>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
        {weeks.map((week) => {
          const skillData: ForecastSkillDatum[] = week.bySkill.map((entry) => ({
            label: t(`skills.${entry.skill}`),
            minutes: entry.minutes,
          }));
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
                <div className="mt-3 h-40">
                  <BarChart
                    aspectRatio="unset"
                    className="h-full"
                    data={skillData}
                    margin={{ top: 8, right: 16, bottom: 8, left: 88 }}
                    orientation="horizontal"
                    xDataKey="label"
                  >
                    <Grid horizontal={false} vertical />
                    <Bar
                      dataKey="minutes"
                      fill="var(--chart-line-primary)"
                      lineCap="round"
                    />
                    <BarYAxis />
                    <ChartTooltip
                      content={({ point }) => <SkillMinutesTooltip point={point} />}
                      showCrosshair={false}
                      showDatePill={false}
                      showDots={false}
                    />
                  </BarChart>
                </div>
              ) : null}
            </div>
          );
        })}
        </div>
      </div>
    </SectionCard>
  );
}
