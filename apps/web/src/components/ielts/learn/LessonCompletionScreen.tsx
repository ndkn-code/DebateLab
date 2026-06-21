"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Check, Trophy, Zap } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { PageTransition } from "@/components/shared/page-motion";
import { PageContainer, ProductPageShell } from "@/components/shared/product-layout";
import { cn } from "@/lib/utils";
import type { MasteryDelta } from "@/lib/ielts/learner/learn-path";
import type { IeltsTextActivityFeedback } from "@/lib/ielts/learn/text-activities";
import { MasteryRow } from "./MasteryRow";

interface CompletionResult {
  xpEarned: number;
  score: number;
  maxScore: number;
  feedback?: IeltsTextActivityFeedback;
  masteryDelta: MasteryDelta[];
  saveError: boolean;
}

/**
 * Lesson completion screen (WS-6.2.3 / WS-D.6): XP earned, score, the before→
 * after mastery change, and bilingual feedback, then the next step. XP/streak and
 * the mastery write happened in `completeActivity`; this screen only reflects them.
 */
export function LessonCompletionScreen({
  lessonTitle,
  unitTitle,
  result,
  nextLessonHref,
  unitHref,
  pathHref,
}: {
  lessonTitle: string;
  unitTitle: string;
  result: CompletionResult;
  nextLessonHref: string | null;
  unitHref: string;
  pathHref: string;
}) {
  const t = useTranslations("dashboard.ielts.learn");
  const locale = useLocale();
  const { feedback } = result;
  const overallFeedback = feedback ? (locale === "vi" ? feedback.vi : feedback.en) : null;

  return (
    <PageTransition>
      <ProductPageShell>
        <PageContainer size="focused" className="flex flex-col gap-6 py-8 lg:py-12">
          {/* Celebration header */}
          <header className="flex flex-col items-center gap-3 text-center">
            <span
              aria-hidden="true"
              className="flex size-16 items-center justify-center rounded-3xl bg-reward-container text-reward-dim"
            >
              <Trophy className="size-8" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="type-eyebrow font-semibold uppercase text-primary">{unitTitle}</p>
              <h1 className="type-heading-lg font-bold text-on-surface">{t("completion_title")}</h1>
              <p className="type-body-sm text-on-surface-variant">{lessonTitle}</p>
            </div>
          </header>

          {/* XP + score stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center gap-1 rounded-3xl border border-outline-variant bg-surface-container p-5 text-center">
              <span className="flex items-center gap-1 type-display-sm font-bold tabular-nums text-on-surface">
                <Zap className="size-5 text-reward-dim" />
                {result.xpEarned}
              </span>
              <span className="type-caption font-semibold text-on-surface-variant">
                {t("xp_label")}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-3xl border border-outline-variant bg-surface-container p-5 text-center">
              <span className="type-display-sm font-bold tabular-nums text-on-surface">
                {result.maxScore > 0 ? `${result.score}/${result.maxScore}` : "—"}
              </span>
              <span className="type-caption font-semibold text-on-surface-variant">
                {t("score_label")}
              </span>
            </div>
          </div>

          {result.saveError ? (
            <p className="rounded-2xl border border-warning/40 bg-warning-container px-4 py-3 type-body-sm text-on-warning-container">
              {t("save_error")}
            </p>
          ) : null}

          {/* Mastery change */}
          {result.masteryDelta.length > 0 ? (
            <section className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 className="type-heading-md font-semibold text-on-surface">
                  {t("mastery_change_title")}
                </h2>
                <p className="type-body-sm text-on-surface-variant">{t("mastery_change_hint")}</p>
              </div>
              <div className="flex flex-col gap-3">
                {result.masteryDelta.map((delta) => (
                  <MasteryRow
                    key={delta.key}
                    mastery={{
                      key: delta.key,
                      skill: delta.skill,
                      labelEn: delta.labelEn,
                      labelVi: delta.labelVi,
                      masteryPercent: delta.afterPercent,
                      confidence: delta.confidence,
                      evidenceCount: delta.evidenceCount,
                      level: delta.level,
                    }}
                    delta={delta.deltaPercent}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {/* Feedback */}
          {overallFeedback ? (
            <section className="flex flex-col gap-3 rounded-3xl border border-outline-variant bg-surface-container p-5">
              <h2 className="type-title font-semibold text-on-surface">{t("feedback_title")}</h2>
              <p className="type-body-sm text-on-surface-variant">{overallFeedback}</p>
              {feedback && feedback.items.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {feedback.items.map((item, index) => (
                    <li key={item.questionId} className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                          item.correct
                            ? "bg-success-container text-success-dim"
                            : "bg-warning-container text-on-warning-container",
                        )}
                      >
                        {item.correct ? "✓" : index + 1}
                      </span>
                      <span className="type-body-sm text-on-surface-variant">
                        {locale === "vi" ? item.feedbackVi : item.feedbackEn}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {/* Next steps */}
          <div className="flex flex-col gap-3 sm:flex-row">
            {nextLessonHref ? (
              <Link
                href={nextLessonHref}
                className={cn(buttonVariants({ variant: "primary" }), "flex-1")}
              >
                {t("next_lesson_cta")}
                <ArrowRight className="size-4" />
              </Link>
            ) : null}
            <Link
              href={unitHref}
              className={cn(
                buttonVariants({ variant: nextLessonHref ? "secondary" : "primary" }),
                "flex-1",
              )}
            >
              {nextLessonHref ? (
                t("finish_cta")
              ) : (
                <>
                  <Check className="size-4" />
                  {t("finish_cta")}
                </>
              )}
            </Link>
          </div>
          <Link
            href={pathHref}
            className="text-center type-body-sm font-semibold text-primary hover:underline"
          >
            {t("back_to_path")}
          </Link>
        </PageContainer>
      </ProductPageShell>
    </PageTransition>
  );
}
