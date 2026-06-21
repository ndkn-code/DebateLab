"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Sparkles } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { PageTransition } from "@/components/shared/page-motion";
import { PageContainer, ProductPageShell } from "@/components/shared/product-layout";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { focusFirst, type LearnUnitView } from "@/lib/ielts/learner/learn-path";
import { IeltsEmptyState } from "@/components/ielts/learner/EmptyState";
import { LessonRow } from "./LessonRow";
import { MasteryRow } from "./MasteryRow";

/** The path/unit screen (WS-6.2.3 / WS-D.6): a unit's lessons + its mastery. */
export function LearnUnitScreen({ view }: { view: LearnUnitView }) {
  const t = useTranslations("dashboard.ielts.learn");
  const { unit, recommended } = view;
  const masteries = focusFirst(unit.subskillMastery).filter((m) => m.evidenceCount > 0);

  return (
    <PageTransition>
      <ProductPageShell>
        <PageContainer size="standard" className="flex flex-col gap-6 py-6 lg:py-8">
          <Link
            href="/ielts/learn"
            className="inline-flex w-fit items-center gap-1.5 type-body-sm font-semibold text-on-surface-variant hover:text-on-surface"
          >
            <ArrowLeft className="size-4" />
            {t("back_to_path")}
          </Link>

          <header className="flex flex-col gap-3 rounded-3xl border border-outline-variant bg-surface-container p-6">
            <div className="flex flex-col gap-1">
              <p className="type-eyebrow font-semibold uppercase text-primary">{view.courseTitle}</p>
              <h1 className="type-heading-lg font-bold text-on-surface">{unit.title}</h1>
              {unit.description ? (
                <p className="type-body-sm text-on-surface-variant">{unit.description}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between type-caption text-on-surface-variant">
                <span>{t("unit_lessons", { count: unit.totalCount })}</span>
                <span className="font-semibold tabular-nums">
                  {unit.completedCount}/{unit.totalCount}
                </span>
              </div>
              <Progress value={unit.progressPercent} tone={unit.isComplete ? "success" : "primary"} />
            </div>
            {recommended ? (
              <Link
                href={recommended.href}
                className={cn(buttonVariants({ variant: "primary", size: "sm" }), "w-fit")}
              >
                <Sparkles className="size-4" />
                {unit.completedCount > 0 ? t("continue_cta") : t("start_path_cta")}
                <ArrowRight className="size-4" />
              </Link>
            ) : null}
          </header>

          {/* Lessons */}
          <section className="flex flex-col gap-3">
            <h2 className="type-heading-md font-semibold text-on-surface">{t("units_title")}</h2>
            {unit.lessons.length > 0 ? (
              <div className="flex flex-col gap-2">
                {unit.lessons.map((lesson, index) => (
                  <LessonRow key={lesson.id} lesson={lesson} index={index} />
                ))}
              </div>
            ) : (
              <IeltsEmptyState
                icon={<BookOpen className="size-6" />}
                title={t("unit_empty_title")}
                body={t("unit_empty_body")}
              />
            )}
          </section>

          {/* Mastery this unit trains (evidence-backed only) */}
          {masteries.length > 0 ? (
            <section className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 className="type-heading-md font-semibold text-on-surface">{t("mastery_label")}</h2>
                <p className="type-body-sm text-on-surface-variant">{t("focus_areas_hint")}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {masteries.map((mastery) => (
                  <MasteryRow key={mastery.key} mastery={mastery} />
                ))}
              </div>
            </section>
          ) : null}
        </PageContainer>
      </ProductPageShell>
    </PageTransition>
  );
}
