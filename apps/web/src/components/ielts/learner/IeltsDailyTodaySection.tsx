"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Check, Clock3 } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IeltsHomeRetentionView } from "@/lib/ielts/home/retention";
import type { IeltsTodayItemView } from "@/lib/ielts/home/today";
import { IELTS_SKILL_ICON } from "./skill-icon";

function PrimaryTodayAction({
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
      className="group flex min-w-0 flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 transition-[border-color,background-color,transform] duration-150 hover:-translate-y-px hover:border-primary/50 hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transform-none sm:flex-row sm:items-center"
    >
      <span className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="type-caption font-semibold uppercase tracking-wide text-on-surface-variant">
              {t("daily_loop_next_label")}
            </span>
            {showOverdue ? (
              <span className="rounded-md bg-error-container px-2 py-0.5 type-caption font-semibold text-on-error-container">
                {t("today_overdue")}
              </span>
            ) : item.isOverdue ? (
              <span className="rounded-md bg-primary-container px-2 py-0.5 type-caption font-semibold text-on-primary-container">
                {t("today_ready")}
              </span>
            ) : null}
          </span>
          <span className="mt-1 block type-title font-semibold text-on-surface">
            {title}
          </span>
          <span className="mt-0.5 block truncate type-body-sm text-on-surface-variant">
            {rationale}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-2 type-caption text-on-surface-variant">
            <span>{t(`skill_${item.skill}`)}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3.5" aria-hidden />
              {t("minutes", { count: item.estimatedMinutes })}
            </span>
          </span>
        </span>
      </span>
      <span className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-[10px] bg-on-surface px-3 type-label font-semibold text-surface transition-colors group-hover:bg-primary group-hover:text-on-primary">
        {t("today_start")}
        <ArrowRight className="size-4" aria-hidden />
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
    <div className="flex min-w-0 flex-col items-start gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success-container text-on-success-container">
        <Check className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="type-title font-semibold text-on-surface">
          {firstRunGrace
            ? t("today_first_run_title")
            : hasGoal
              ? t("today_empty_title")
              : t("today_diagnostic_title")}
        </h3>
        <p className="mt-0.5 type-body-sm text-on-surface-variant">
          {firstRunGrace
            ? t("today_first_run_body")
            : hasGoal
              ? t("today_empty_body")
              : t("today_diagnostic_body")}
        </p>
      </div>
      <Link
        href={href}
        className={cn(buttonVariants({ variant: "primary" }), "shrink-0")}
      >
        {hasGoal
          ? t("cta_view_plan")
          : diagnosticReady
            ? t("cta_start_diagnostic")
            : t("cta_view_plan")}
        <ArrowRight className="size-4" aria-hidden />
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
  const primaryItem = items[0];
  const remainingCount = overflowCount + Math.max(0, items.length - 1);

  return (
    <div className="mt-4 min-w-0">
      {primaryItem ? (
        <PrimaryTodayAction
          item={primaryItem}
          softenDueState={retention.isFirstRunGrace}
        />
      ) : (
        <EmptyToday
          diagnosticReady={diagnosticReady}
          firstRunGrace={retention.isFirstRunGrace}
          hasGoal={hasGoal}
        />
      )}

      {remainingCount > 0 ? (
        <Link
          href="/ielts/study-plan"
          className="mt-2.5 inline-flex min-h-8 items-center gap-1 type-label font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {t("today_more", { count: remainingCount })}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
