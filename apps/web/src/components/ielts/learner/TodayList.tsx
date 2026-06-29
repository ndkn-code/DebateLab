"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Clock3, ListChecks } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IeltsTodayItemView } from "@/lib/ielts/home/today";
import { IELTS_SKILL_ICON } from "./skill-icon";

function TodayItemCard({
  item,
  softenDueState,
}: {
  item: IeltsTodayItemView;
  softenDueState: boolean;
}) {
  const t = useTranslations("dashboard.ielts");
  const locale = useLocale();
  const Icon = IELTS_SKILL_ICON[item.skill];
  const title = locale === "vi" ? item.titleVi : item.titleEn;
  const rationale = locale === "vi" ? item.rationaleVi : item.rationaleEn;
  const showOverdue = item.isOverdue && !softenDueState;

  return (
    <Link
      href={item.launchHref}
      className="group flex items-center gap-4 rounded-2xl border border-outline-variant bg-surface px-4 py-3.5 transition-colors hover:border-primary hover:bg-surface-container"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-on-surface-variant">
        <Icon className="size-5" aria-hidden />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate type-body font-semibold text-on-surface">
            {title}
          </span>
          {showOverdue ? (
            <span className="type-caption font-semibold uppercase text-error">
              {t("today_overdue")}
            </span>
          ) : item.isOverdue ? (
            <span className="type-caption font-semibold uppercase text-primary">
              {t("today_ready")}
            </span>
          ) : null}
        </div>
        <p className="line-clamp-1 type-body-sm text-on-surface-variant">{rationale}</p>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 type-caption text-on-surface-variant">
          <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-medium">
            {t(`itemkind_${item.kind}`)}
          </span>
          <span>{t(`skill_${item.skill}`)}</span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3.5" aria-hidden />
            {t("minutes", { count: item.estimatedMinutes })}
          </span>
        </div>
      </div>

      <span
        aria-hidden
        className="hidden shrink-0 items-center gap-1 type-body-sm font-semibold text-primary sm:inline-flex"
      >
        {t("today_start")}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

/**
 * The "Today" task list (WS-6.2.1): the 2–5 prioritized plan items the learner
 * should do now, each launching the real underlying activity / mock / review
 * (study-plan-engine.md WS-C.8). Diagnostic-first when there's no plan yet, and
 * a gentle empty state when a plan exists but nothing is due.
 */
export function TodayList({
  items,
  overflowCount,
  hasGoal,
  diagnosticReady,
  totalMinutes,
  softenDueState = false,
}: {
  items: IeltsTodayItemView[];
  overflowCount: number;
  hasGoal: boolean;
  diagnosticReady: boolean;
  totalMinutes: number;
  softenDueState?: boolean;
}) {
  const t = useTranslations("dashboard.ielts");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="type-heading-md font-semibold text-on-surface">
          {t("today_title")}
        </h2>
        {items.length > 0 ? (
          <span className="type-body-sm text-on-surface-variant">
            {t("today_total_minutes", { count: totalMinutes })}
          </span>
        ) : null}
      </div>

      {items.length > 0 ? (
        <>
          <div className="flex flex-col gap-2.5">
            {items.map((item) => (
              <TodayItemCard
                key={item.id}
                item={item}
                softenDueState={softenDueState}
              />
            ))}
          </div>
          {overflowCount > 0 ? (
            <Link
              href="/ielts/study-plan"
              className="inline-flex items-center gap-1 self-start type-body-sm font-semibold text-primary hover:underline"
            >
              {t("today_more", { count: overflowCount })}
              <ArrowRight className="size-4" />
            </Link>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-outline-variant bg-surface-container p-6">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-surface-container-high text-on-surface-variant">
            <ListChecks className="size-5" aria-hidden />
          </span>
          <div>
            <h3 className="type-title font-semibold text-on-surface">
              {hasGoal ? t("today_empty_title") : t("today_diagnostic_title")}
            </h3>
            <p className="mt-1 max-w-prose type-body-sm text-on-surface-variant">
              {hasGoal ? t("today_empty_body") : t("today_diagnostic_body")}
            </p>
          </div>
          <Link
            href={hasGoal ? "/ielts/study-plan" : "/ielts/onboarding"}
            className={cn(buttonVariants({ variant: hasGoal ? "secondary" : "primary" }))}
          >
            {hasGoal
              ? t("cta_view_plan")
              : diagnosticReady
                ? t("cta_start_diagnostic")
                : t("cta_view_plan")}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      )}
    </section>
  );
}
