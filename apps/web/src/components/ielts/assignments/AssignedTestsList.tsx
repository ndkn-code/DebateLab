"use client";

/**
 * Learner "assigned tests" list (WS-5.3): the IELTS mocks a learner's teachers
 * have assigned to their classes, with per-assignment progress and the right
 * call-to-action (start a sitting, or review a finished one).
 */
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronRight } from "@/components/ui/icons";
import { bandText } from "@/components/ielts/results/format";
import type { LearnerAssignedTest } from "@/lib/api/ielts/learner-assignments-repository";
import { ieltsPaths, localizedPath } from "@/lib/ielts/routes";
import { ASSIGNMENT_STATE_PILL } from "./state-pill";

function formatDate(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function AssignedCard({
  test,
  locale,
}: {
  test: LearnerAssignedTest;
  locale: string;
}) {
  const t = useTranslations("ielts.assignments");
  const { state, resultAttemptId, overallBand } = test.progress;
  const due = formatDate(test.dueAt, locale);

  const showResults =
    (state === "completed" || state === "submitted") &&
    Boolean(resultAttemptId);
  const href =
    showResults && resultAttemptId
      ? localizedPath(locale, ieltsPaths.results(resultAttemptId))
      : test.testSlug
        ? localizedPath(
            locale,
            ieltsPaths.mock(test.testSlug, { assignment: test.assignmentId }),
          )
        : null;
  const ctaLabel = showResults
    ? t("learner.viewResults")
    : state === "in_progress"
      ? t("learner.resume")
      : t("learner.start");

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-surface-container-low">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="type-title font-semibold text-on-surface line-clamp-2">
            {test.testTitle ?? test.title}
          </h2>
          {test.className ? (
            <p className="type-caption text-on-surface-variant line-clamp-2">
              {test.className}
            </p>
          ) : null}
        </div>
        <span
          className={`inline-flex min-h-5 shrink-0 items-center rounded-md px-2 type-caption font-semibold ${ASSIGNMENT_STATE_PILL[state]}`}
        >
          {t(`state.${state}`)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="type-caption text-on-surface-variant">
          {due ? t("learner.due", { date: due }) : t("learner.noDue")}
        </p>
        {overallBand !== null ? (
          <p className="type-caption text-on-surface-variant">
            {t("learner.band", { band: bandText(overallBand) })}
          </p>
        ) : null}
      </div>

      {href ? (
        <Link
          href={href}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-control bg-on-surface px-3 type-label font-semibold text-surface transition-colors hover:bg-primary hover:text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {ctaLabel}
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : null}
    </article>
  );
}

export function AssignedTestsList({
  tests,
  locale,
}: {
  tests: LearnerAssignedTest[];
  locale: string;
}) {
  const t = useTranslations("ielts.assignments");
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="type-heading-lg text-on-surface">
          {t("learner.title")}
        </h1>
        <p className="type-body-sm text-on-surface-variant">
          {t("learner.subtitle")}
        </p>
      </header>

      {tests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 py-8 text-center type-body-sm text-on-surface-variant">
          {t("learner.empty")}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tests.map((test) => (
            <AssignedCard key={test.assignmentId} test={test} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
