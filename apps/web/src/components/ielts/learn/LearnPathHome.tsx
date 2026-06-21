"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Compass, Sparkles, Trophy } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { PageTransition } from "@/components/shared/page-motion";
import { PageContainer, ProductPageShell } from "@/components/shared/product-layout";
import { cn } from "@/lib/utils";
import { focusFirst, type LearnPathView } from "@/lib/ielts/learner/learn-path";
import { IeltsEmptyState } from "@/components/ielts/learner/EmptyState";
import { UnitCard } from "./UnitCard";
import { MasteryRow } from "./MasteryRow";

const FOCUS_LIMIT = 4;

/**
 * IELTS Learn home (WS-6.2.3 / WS-D.6): the guided path of units and micro-
 * lessons built over the existing course spine, with the recommended next lesson
 * kept visually primary and evidence-backed mastery. Diagnostic-first: when no
 * path content is seeded we point to the diagnostic rather than faking progress.
 */
export function LearnPathHome({ path }: { path: LearnPathView | null }) {
  const t = useTranslations("dashboard.ielts.learn");

  const isEmpty = !path || path.units.length === 0 || path.totalCount === 0;

  return (
    <PageTransition>
      <ProductPageShell>
        <PageContainer size="wide" className="flex flex-col gap-8 py-6 lg:py-8">
          <header className="flex flex-col gap-1">
            <p className="type-eyebrow font-semibold uppercase text-primary">{t("eyebrow")}</p>
            <h1 className="type-heading-xl font-bold text-balance text-on-surface">
              {path ? path.courseTitle : t("title")}
            </h1>
          </header>

          {isEmpty ? (
            <IeltsEmptyState
              icon={<Compass className="size-6" />}
              title={t("empty_title")}
              body={t("empty_body")}
              action={
                <Link
                  href="/ielts/onboarding"
                  className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
                >
                  {t("empty_cta_diagnostic")}
                  <ArrowRight className="size-4" />
                </Link>
              }
            />
          ) : (
            <PathBody path={path} t={t} />
          )}
        </PageContainer>
      </ProductPageShell>
    </PageTransition>
  );
}

function PathBody({
  path,
  t,
}: {
  path: LearnPathView;
  t: ReturnType<typeof useTranslations>;
}) {
  const focusAreas = focusFirst(path.masteryOverview)
    .filter((mastery) => mastery.evidenceCount > 0)
    .slice(0, FOCUS_LIMIT);

  return (
    <>
      {/* Recommended-next / progress hero — the primary call to action. */}
      <section className="overflow-hidden rounded-3xl border border-outline-variant bg-surface-container p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {path.recommended ? (
              <>
                <p className="inline-flex items-center gap-1.5 type-eyebrow font-semibold uppercase text-primary">
                  <Sparkles className="size-3.5" />
                  {t("recommended_eyebrow")}
                </p>
                <h2 className="mt-1 type-heading-lg font-bold text-on-surface">
                  {path.recommended.lessonTitle}
                </h2>
                <p className="mt-1 type-body-sm text-on-surface-variant">
                  {path.recommended.unitTitle} ·{" "}
                  {t("minutes", { count: path.recommended.estimatedMinutes })}
                </p>
                <Link
                  href={path.recommended.href}
                  className={cn(buttonVariants({ variant: "primary" }), "mt-5")}
                >
                  {path.completedCount > 0 ? t("continue_cta") : t("start_path_cta")}
                  <ArrowRight className="size-4" />
                </Link>
              </>
            ) : (
              <>
                <p className="inline-flex items-center gap-1.5 type-eyebrow font-semibold uppercase text-success">
                  <Trophy className="size-3.5" />
                  {t("path_complete_title")}
                </p>
                <h2 className="mt-1 type-heading-lg font-bold text-on-surface">
                  {t("path_complete_title")}
                </h2>
                <p className="mt-1 max-w-prose type-body-sm text-on-surface-variant">
                  {t("path_complete_body")}
                </p>
              </>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-center justify-center gap-2 rounded-2xl bg-primary-container px-7 py-5 text-center">
            <span className="type-display-sm font-bold tabular-nums text-on-primary-container">
              {path.progressPercent}%
            </span>
            <span className="type-caption font-semibold text-on-primary-container">
              {t("subtitle_progress", { completed: path.completedCount, total: path.totalCount })}
            </span>
          </div>
        </div>
      </section>

      {/* Focus areas — weakest evidence-backed subskills first. */}
      {focusAreas.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="type-heading-md font-semibold text-on-surface">{t("focus_areas_title")}</h2>
            <p className="type-body-sm text-on-surface-variant">{t("focus_areas_hint")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {focusAreas.map((mastery) => (
              <MasteryRow key={mastery.key} mastery={mastery} />
            ))}
          </div>
        </section>
      ) : null}

      {/* The units of the path. */}
      <section className="flex flex-col gap-3">
        <h2 className="type-heading-md font-semibold text-on-surface">{t("units_title")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {path.units.map((unit, index) => (
            <UnitCard key={unit.id} unit={unit} index={index} />
          ))}
        </div>
      </section>
    </>
  );
}
