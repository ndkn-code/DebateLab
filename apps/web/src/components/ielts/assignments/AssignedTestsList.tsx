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
import { ASSIGNMENT_STATE_PILL } from "./state-pill";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function AssignedCard({ test, locale }: { test: LearnerAssignedTest; locale: string }) {
  const t = useTranslations("ielts.assignments");
  const { state, resultAttemptId, overallBand } = test.progress;
  const due = formatDate(test.dueAt);

  const showResults = (state === "completed" || state === "submitted") && Boolean(resultAttemptId);
  const href = showResults
    ? `/${locale}/ielts/attempts/${resultAttemptId}/results`
    : test.testSlug
      ? `/${locale}/ielts/mock/${test.testSlug}?assignment=${test.assignmentId}`
      : null;
  const ctaLabel = showResults
    ? t("learner.viewResults")
    : state === "in_progress"
      ? t("learner.resume")
      : t("learner.start");

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface p-5 shadow-token-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="type-title truncate text-on-surface">{test.testTitle ?? test.title}</h2>
          {test.className ? (
            <p className="truncate text-xs text-on-surface-variant">{test.className}</p>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${ASSIGNMENT_STATE_PILL[state]}`}
        >
          {t(`state.${state}`)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="type-caption text-on-surface-variant">{due ? t("learner.due", { date: due }) : t("learner.noDue")}</p>
        {overallBand !== null ? (
          <p className="type-caption text-on-surface-variant">
            {t("learner.band", { band: bandText(overallBand) })}
          </p>
        ) : null}
      </div>

      {href ? (
        <Link
          href={href}
          className="inline-flex items-center justify-center gap-1 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary"
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
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="type-heading-lg text-on-surface">{t("learner.title")}</h1>
        <p className="type-body-sm text-on-surface-variant">{t("learner.subtitle")}</p>
      </header>

      {tests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-outline-variant px-4 py-12 text-center text-sm text-on-surface-variant">
          {t("learner.empty")}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tests.map((test) => (
            <AssignedCard key={test.assignmentId} test={test} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
