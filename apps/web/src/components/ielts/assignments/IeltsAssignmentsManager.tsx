"use client";

/**
 * Teacher IELTS assignments surface (WS-5.3): the assign form plus the list of
 * this club's IELTS-mock assignments, each linking to its per-student results.
 * Archiving runs through the `archiveIeltsAssignment` server action.
 */
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { archiveIeltsAssignment } from "@/app/actions/ielts/assignments";
import { bandText } from "@/components/ielts/results/format";
import type { IeltsMockAssignmentRow } from "@/lib/api/ielts/assignments-repository";
import type { AssignableClass, AssignableTest } from "@/lib/api/ielts/assignment-manager-page";
import type {
  IeltsClassStudyPlanClassView,
  IeltsClassStudyPlanLearnerView,
  IeltsClassStudyPlanProgressView,
  IeltsClassStudyPlanSurfaceView,
  IeltsClassStudyPlanWeakSubskillView,
  IeltsClassStudyPlanWeaknessSeverity,
} from "@/lib/ielts/study-plan/class-view";
import { IeltsAssignForm } from "./IeltsAssignForm";

const WEAKNESS_PILL: Record<IeltsClassStudyPlanWeaknessSeverity, string> = {
  critical: "bg-error-container text-on-error-container",
  weak: "bg-warning-container text-on-warning-container",
  watch: "bg-surface-container-high text-on-surface-variant",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function ProgressCounts({ progress }: { progress: IeltsClassStudyPlanProgressView }) {
  const t = useTranslations("ielts.assignments");
  return (
    <div className="grid grid-cols-3 gap-1 text-center text-xs">
      <div className="rounded-lg bg-success-container px-2 py-1 text-success-dim">
        <span className="block font-bold">{progress.done}</span>
        {t("teacher.progressDone")}
      </div>
      <div className="rounded-lg bg-surface-container-high px-2 py-1 text-on-surface-variant">
        <span className="block font-bold text-on-surface">{progress.scheduled}</span>
        {t("teacher.progressScheduled")}
      </div>
      <div className="rounded-lg bg-error-container px-2 py-1 text-on-error-container">
        <span className="block font-bold">{progress.missed}</span>
        {t("teacher.progressMissed")}
      </div>
    </div>
  );
}

function WeaknessChip({
  weakness,
  locale,
}: {
  weakness: IeltsClassStudyPlanWeakSubskillView;
  locale: string;
}) {
  const t = useTranslations("ielts.assignments");
  const skillT = useTranslations("ielts.studyPlan.skills");
  const label = locale.startsWith("vi") ? weakness.labelVi : weakness.labelEn;

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${WEAKNESS_PILL[weakness.severity]}`}
      title={t("teacher.weaknessTooltip", {
        confidence: weakness.confidencePercent,
        evidence: weakness.evidenceCount,
      })}
    >
      <span className="shrink-0">{skillT(weakness.skill)}</span>
      <span className="min-w-0 truncate">· {label}</span>
    </span>
  );
}

function ClassStudyPlanSummary({ view }: { view: IeltsClassStudyPlanSurfaceView }) {
  const t = useTranslations("ielts.assignments");
  const stats = [
    { label: t("teacher.summaryClasses"), value: view.classCount },
    { label: t("teacher.summaryLearners"), value: view.learnerCount },
    { label: t("teacher.summaryActivePlans"), value: view.activePlanCount },
    { label: t("teacher.summaryAvgBand"), value: bandText(view.averagePredictedBand) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-2xl border border-outline-variant bg-surface px-4 py-3">
          <p className="type-caption text-on-surface-variant">{stat.label}</p>
          <p className="type-title text-on-surface">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

function LearnerPlanRow({
  learner,
  locale,
}: {
  learner: IeltsClassStudyPlanLearnerView;
  locale: string;
}) {
  const t = useTranslations("ielts.assignments");

  return (
    <tr className="border-t border-outline-variant/40">
      <td className="sticky left-0 z-10 bg-surface px-3 py-3">
        <div className="flex items-start gap-2">
          {learner.needsAttention ? (
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full bg-error"
              aria-label={t("teacher.attention")}
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate font-semibold text-on-surface">{learner.displayName}</p>
            {learner.email ? (
              <p className="truncate text-xs text-on-surface-variant">{learner.email}</p>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-center">
        <p className="font-bold text-on-surface">
          {learner.hasActivePlan ? bandText(learner.predictedBand) : t("teacher.noActivePlanShort")}
        </p>
        {learner.targetBand !== null ? (
          <p className="text-xs text-on-surface-variant">
            {t("teacher.targetBand", { band: bandText(learner.targetBand) })}
          </p>
        ) : null}
      </td>
      <td className="px-3 py-3">
        {learner.hasActivePlan ? (
          <div className="flex flex-col gap-2">
            <ProgressCounts progress={learner.progress} />
            <p className="text-center text-xs text-on-surface-variant">
              {t("teacher.completion", { percent: learner.progress.completionPercent })}
            </p>
          </div>
        ) : (
          <p className="text-center text-xs font-semibold text-on-surface-variant">
            {t("teacher.noActivePlan")}
          </p>
        )}
      </td>
      <td className="px-3 py-3">
        {learner.weakSubskills.length === 0 ? (
          <p className="text-xs text-on-surface-variant">{t("teacher.noWeakness")}</p>
        ) : (
          <div className="flex max-w-[280px] flex-wrap gap-1.5">
            {learner.weakSubskills.map((weakness) => (
              <WeaknessChip key={weakness.key} weakness={weakness} locale={locale} />
            ))}
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        <a href="#ielts-assign-form" className="text-sm font-semibold text-primary">
          {t("teacher.assignWork")}
        </a>
      </td>
    </tr>
  );
}

function ClassPlanCard({ classView }: { classView: IeltsClassStudyPlanClassView }) {
  const t = useTranslations("ielts.assignments");
  const locale = useLocale();

  return (
    <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface shadow-token-card">
      <div className="flex flex-col gap-3 border-b border-outline-variant px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 className="type-title truncate text-on-surface">{classView.title}</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            {t("teacher.activePlansCount", {
              active: classView.activePlanCount,
              total: classView.learnerCount,
            })}
            {" · "}
            {t("teacher.needsAttentionCount", { count: classView.needsAttentionCount })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-primary-container px-3 py-1 font-semibold text-on-primary-container">
            {t("teacher.averageBand", { band: bandText(classView.averagePredictedBand) })}
          </span>
          <span className="rounded-full bg-surface-container-high px-3 py-1 font-semibold text-on-surface-variant">
            {t("teacher.progressCounts", {
              done: classView.progress.done,
              scheduled: classView.progress.scheduled,
              missed: classView.progress.missed,
            })}
          </span>
        </div>
      </div>

      <div className="border-b border-outline-variant/60 px-4 py-3">
        <p className="type-label text-on-surface-variant">{t("teacher.classFocus")}</p>
        {classView.weakSubskills.length === 0 ? (
          <p className="mt-1 text-sm text-on-surface-variant">{t("teacher.noClassFocus")}</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {classView.weakSubskills.map((weakness) => (
              <span key={weakness.key} className="inline-flex max-w-full items-center gap-2">
                <WeaknessChip weakness={weakness} locale={locale} />
                <span className="text-xs text-on-surface-variant">
                  {t("teacher.affectedLearners", { count: weakness.affectedLearnerCount })}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {classView.learners.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-on-surface-variant">
          {t("teacher.classPlansEmptyRoster")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead className="bg-surface-container text-xs uppercase tracking-wide text-on-surface-variant">
              <tr>
                <th className="sticky left-0 z-10 bg-surface-container px-3 py-2 text-left">
                  {t("teacher.learnerColumn")}
                </th>
                <th className="px-3 py-2 text-center">{t("teacher.predictedBandColumn")}</th>
                <th className="px-3 py-2 text-center">{t("teacher.progressColumn")}</th>
                <th className="px-3 py-2 text-left">{t("teacher.weakSubskillsColumn")}</th>
                <th className="px-3 py-2 text-right">{t("teacher.actionColumn")}</th>
              </tr>
            </thead>
            <tbody>
              {classView.learners.map((learner) => (
                <LearnerPlanRow key={learner.userId} learner={learner} locale={locale} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ClassStudyPlansSection({ view }: { view: IeltsClassStudyPlanSurfaceView }) {
  const t = useTranslations("ielts.assignments");
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="type-title text-on-surface">{t("teacher.classPlansHeading")}</h2>
        <p className="mt-1 text-sm text-on-surface-variant">{t("teacher.classPlansSubtitle")}</p>
      </div>

      <ClassStudyPlanSummary view={view} />

      {view.classes.length === 0 ? (
        <p className="rounded-2xl border border-outline-variant bg-surface px-4 py-10 text-center text-sm text-on-surface-variant">
          {t("teacher.classPlansEmpty")}
        </p>
      ) : (
        view.classes.map((classView) => <ClassPlanCard key={classView.id} classView={classView} />)
      )}
    </section>
  );
}

function ArchiveButton({ clubId, assignmentId }: { clubId: string; assignmentId: string }) {
  const t = useTranslations("ielts.assignments");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await archiveIeltsAssignment({ clubId, assignmentId });
          router.refresh();
        })
      }
      className="rounded-lg px-2 py-1 text-xs font-semibold text-on-surface-variant hover:text-error disabled:opacity-50"
    >
      {pending ? t("teacher.archiving") : t("teacher.archive")}
    </button>
  );
}

function AssignmentRow({
  clubId,
  assignment,
}: {
  clubId: string;
  assignment: IeltsMockAssignmentRow;
}) {
  const t = useTranslations("ielts.assignments");
  const due = formatDate(assignment.dueAt);
  const isActive = assignment.status === "active";
  return (
    <div className="grid grid-cols-1 gap-3 border-b border-outline-variant/40 px-4 py-3 text-sm last:border-0 sm:grid-cols-[1.6fr_1fr_0.8fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate font-semibold text-on-surface">{assignment.title}</p>
        <p className="truncate text-xs text-on-surface-variant">{assignment.testTitle}</p>
      </div>
      <div className="text-on-surface-variant">{assignment.classTitle ?? "—"}</div>
      <div className="text-on-surface-variant">{due ?? t("teacher.noDue")}</div>
      <div className="flex items-center justify-end gap-3">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            isActive
              ? "bg-success-container text-success-dim"
              : "bg-surface-container-high text-on-surface-variant"
          }`}
        >
          {isActive ? t("teacher.statusActive") : t("teacher.statusArchived")}
        </span>
        <Link
          href={`/dashboard/clubs/${clubId}/ielts/${assignment.id}`}
          className="inline-flex items-center gap-1 font-semibold text-primary"
        >
          {t("teacher.viewResults")}
          <ChevronRight className="h-4 w-4" />
        </Link>
        {isActive ? <ArchiveButton clubId={clubId} assignmentId={assignment.id} /> : null}
      </div>
    </div>
  );
}

export function IeltsAssignmentsManager({
  clubId,
  clubName,
  classes,
  tests,
  assignments,
  classStudyPlans,
}: {
  clubId: string;
  clubName: string;
  classes: AssignableClass[];
  tests: AssignableTest[];
  assignments: IeltsMockAssignmentRow[];
  classStudyPlans: IeltsClassStudyPlanSurfaceView;
}) {
  const t = useTranslations("ielts.assignments");
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link
          href={`/dashboard/clubs/${clubId}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("teacher.backToClub")}
        </Link>
        <h1 className="type-heading-lg text-on-surface">{t("teacher.title")}</h1>
        <p className="type-body-sm text-on-surface-variant">
          {clubName} · {t("teacher.subtitle")}
        </p>
      </header>

      <ClassStudyPlansSection view={classStudyPlans} />

      <IeltsAssignForm clubId={clubId} classes={classes} tests={tests} />

      <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface shadow-token-card">
        <div className="border-b border-outline-variant px-4 py-3">
          <h2 className="type-title text-on-surface">{t("teacher.listHeading")}</h2>
        </div>
        {assignments.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-on-surface-variant">
            {t("teacher.empty")}
          </p>
        ) : (
          assignments.map((assignment) => (
            <AssignmentRow key={assignment.id} clubId={clubId} assignment={assignment} />
          ))
        )}
      </section>
    </div>
  );
}
