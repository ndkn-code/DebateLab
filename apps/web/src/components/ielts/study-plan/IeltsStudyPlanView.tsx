"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  RefreshCw,
  Target,
} from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { PageTransition } from "@/components/shared/page-motion";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { showToast } from "@/components/shared/toast";
import { regenerateIeltsStudyPlanAction } from "@/app/actions/ielts/study-plan";
import type { IeltsStudyPlanPageView } from "@/lib/ielts/study-plan/page-view";
import { cn } from "@/lib/utils";
import { StudyPlanCalendar, StudyPlanForecast } from "./StudyPlanCalendar";
import { StudyPlanGoal } from "./StudyPlanGoal";
import { StudyPlanReassessment } from "./StudyPlanReassessment";
import { StudyPlanReasoning } from "./StudyPlanReasoning";
import { StudyPlanReviewQueue } from "./StudyPlanReviewQueue";
import { StudyPlanRevisionLog } from "./StudyPlanRevisionLog";
import { SectionCard, formatShortDate } from "./shared";

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1 type-caption font-semibold text-on-surface-variant">
      {children}
    </span>
  );
}

export function IeltsStudyPlanView({
  view,
  diagnosticHref,
}: {
  view: IeltsStudyPlanPageView;
  diagnosticHref: string | null;
}) {
  const t = useTranslations("ielts.studyPlan");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, startTransition] = useTransition();

  const regenerate = () => {
    startTransition(async () => {
      setError(null);
      try {
        await regenerateIeltsStudyPlanAction();
        showToast(t("regenerate_success"), "success");
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : t("error_generic");
        setError(message);
        showToast(message, "error");
      }
    });
  };

  const countdown = view.countdown;
  const countdownLabel = !countdown
    ? ""
    : countdown.isPastTestDate
      ? t("test_passed")
      : countdown.daysUntilTest <= 0
        ? t("test_today")
        : t("days_to_test", { count: countdown.daysUntilTest });

  return (
    <PageTransition>
      <ProductPageShell>
        <PageContainer size="wide" className="flex flex-col gap-6 py-6 lg:py-8">
          <Link
            href="/ielts"
            className="inline-flex w-fit items-center gap-1 type-body-sm font-semibold text-on-surface-variant hover:text-on-surface"
          >
            <ArrowLeft className="size-4" />
            {t("back_home")}
          </Link>

          {error ? (
            <p className="rounded-lg bg-error-container px-4 py-3 type-body-sm font-medium text-error">
              {error}
            </p>
          ) : null}

          {view.status === "no_plan" ? (
            <section className="rounded-lg border border-outline-variant bg-surface-container p-6 text-center shadow-token-card sm:p-8">
              <span className="mx-auto inline-flex size-11 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                <GraduationCap className="size-6" />
              </span>
              <h1 className="mt-4 type-heading-lg font-bold text-on-surface">
                {t("no_plan_title")}
              </h1>
              <p className="mx-auto mt-2 max-w-prose type-body text-on-surface-variant">
                {t("no_plan_body")}
              </p>
              <Link
                href="/ielts/onboarding"
                className={cn(buttonVariants({ variant: "primary" }), "mt-6")}
              >
                {t("no_plan_cta")}
                <ArrowRight className="size-4" />
              </Link>
            </section>
          ) : (
            <>
              <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container p-5 shadow-token-card sm:p-6">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="type-label font-semibold uppercase text-primary">
                      {t("eyebrow")}
                    </p>
                    <h1 className="mt-1 type-heading-lg font-bold text-balance text-on-surface">
                      {t("title")}
                    </h1>
                    <p className="mt-2 max-w-prose type-body text-on-surface-variant">
                      {t("intro")}
                    </p>
                  </div>
                  {countdown ? (
                    <div className="flex shrink-0 flex-col items-center justify-center rounded-lg bg-primary-container px-5 py-3 text-center text-on-primary-container">
                      <span className="type-title font-bold text-balance">
                        {countdownLabel}
                      </span>
                      <span className="mt-1 type-caption font-semibold">
                        {formatShortDate(countdown.testDate, locale)}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {countdown ? (
                    <MetaChip>
                      <Target className="size-3.5" />
                      {t("plan_mode")} · {t(`mode.${countdown.mode}`)}
                    </MetaChip>
                  ) : null}
                  {view.module ? (
                    <MetaChip>{t(`module.${view.module}`)}</MetaChip>
                  ) : null}
                  <button
                    type="button"
                    onClick={regenerate}
                    disabled={isRegenerating}
                    title={t("regenerate_hint")}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                  >
                    <RefreshCw
                      className={cn("size-4", isRegenerating && "animate-spin")}
                    />
                    {isRegenerating ? t("regenerating") : t("regenerate")}
                  </button>
                </div>
              </section>

              {view.status === "needs_diagnostic" ? (
                <section className="rounded-lg border border-warning bg-warning-container p-5">
                  <h2 className="type-heading-sm font-bold text-on-warning-container">
                    {t("needs_diagnostic_title")}
                  </h2>
                  <p className="mt-1 max-w-prose type-body-sm text-on-warning-container">
                    {t("needs_diagnostic_body")}
                  </p>
                  <Link
                    href="/ielts/onboarding"
                    className={cn(buttonVariants({ variant: "primary" }), "mt-4")}
                  >
                    {t("needs_diagnostic_cta")}
                    <ArrowRight className="size-4" />
                  </Link>
                </section>
              ) : null}

              {view.goal && view.module ? (
                <SectionCard
                  icon={Target}
                  title={t("goal_title")}
                  caption={t("goal_caption")}
                >
                  <StudyPlanGoal goal={view.goal} module={view.module} />
                </SectionCard>
              ) : null}

              <StudyPlanReasoning view={view} />
              <StudyPlanCalendar view={view} />
              <StudyPlanForecast view={view} />

              <div className="grid gap-6 lg:grid-cols-2">
                <StudyPlanReviewQueue view={view} />
                <StudyPlanReassessment view={view} diagnosticHref={diagnosticHref} />
              </div>

              <StudyPlanRevisionLog view={view} />
            </>
          )}
        </PageContainer>
      </ProductPageShell>
    </PageTransition>
  );
}
