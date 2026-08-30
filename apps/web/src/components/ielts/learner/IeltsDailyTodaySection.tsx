"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Check, Clock3 } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IeltsHomeRetentionView } from "@/lib/ielts/home/retention";
import type { IeltsTodayItemView } from "@/lib/ielts/home/today";
import { IELTS_SKILL_ICON } from "./skill-icon";

function TodayItemRow({
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
      className="group flex min-w-0 items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 transition-colors hover:bg-surface-container"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate type-body font-semibold text-on-surface">
            {title}
          </span>
          {showOverdue ? (
            <span className="rounded-full bg-error-container px-2 py-0.5 type-caption font-semibold uppercase text-on-error-container">
              {t("today_overdue")}
            </span>
          ) : item.isOverdue ? (
            <span className="rounded-full bg-primary-container px-2 py-0.5 type-caption font-semibold uppercase text-on-primary-container">
              {t("today_ready")}
            </span>
          ) : null}
        </span>
        <span className="line-clamp-1 type-body-sm text-on-surface-variant" data-ielts-task-rationale>
          {rationale}
        </span>
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 type-caption text-on-surface-variant">
          <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-medium">
            {t(`itemkind_${item.kind}`)}
          </span>
          <span>{t(`skill_${item.skill}`)}</span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3.5" aria-hidden />
            {t("minutes", { count: item.estimatedMinutes })}
          </span>
        </span>
      </span>
      <span className="hidden shrink-0 items-center gap-1 type-body-sm font-semibold text-primary sm:inline-flex">
        {t("today_start")}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function EmptyToday({
  hasGoal,
  diagnosticReady,
  firstRunGrace,
}: {
  hasGoal: boolean;
  diagnosticReady: boolean;
  firstRunGrace: boolean;
}) {
  const t = useTranslations("dashboard.ielts");
  const href = hasGoal ? "/ielts/study-plan" : "/ielts/onboarding";

  return (
    <div className="flex min-w-0 flex-col items-start gap-3 rounded-lg bg-surface-container-low p-5">
      <span className="flex size-11 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant">
        <Check className="size-5" aria-hidden />
      </span>
      <div>
        <h3 className="type-title font-semibold text-on-surface">
          {firstRunGrace
            ? t("today_first_run_title")
            : hasGoal
              ? t("today_empty_title")
              : t("today_diagnostic_title")}
        </h3>
        <p className="mt-1 max-w-prose type-body-sm text-on-surface-variant">
          {firstRunGrace
            ? t("today_first_run_body")
            : hasGoal
              ? t("today_empty_body")
              : t("today_diagnostic_body")}
        </p>
      </div>
      <Link
        href={href}
        className={cn(
          buttonVariants({ variant: hasGoal ? "secondary" : "primary" }),
        )}
      >
        {hasGoal
          ? t("cta_view_plan")
          : diagnosticReady
            ? t("cta_start_diagnostic")
            : t("cta_view_plan")}
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

export function IeltsDailyTodaySection({
  retention,
  items,
  overflowCount,
  hasGoal,
  diagnosticReady,
}: {
  retention: IeltsHomeRetentionView;
  items: IeltsTodayItemView[];
  overflowCount: number;
  hasGoal: boolean;
  diagnosticReady: boolean;
}) {
  const t = useTranslations("dashboard.ielts");

  return (
    <div className="mt-4 min-w-0">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-col gap-2.5">
          {items.length > 0 ? (
            items.map((item) => (
              <TodayItemRow
                key={item.id}
                item={item}
                softenDueState={retention.isFirstRunGrace}
              />
            ))
          ) : (
            <EmptyToday
              diagnosticReady={diagnosticReady}
              firstRunGrace={retention.isFirstRunGrace}
              hasGoal={hasGoal}
            />
          )}
        </div>
        {overflowCount > 0 ? (
          <Link
            href="/ielts/study-plan"
            className="mt-3 inline-flex items-center gap-1 type-body-sm font-semibold text-primary hover:underline"
          >
            {t("today_more", { count: overflowCount })}
            <ArrowRight className="size-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
