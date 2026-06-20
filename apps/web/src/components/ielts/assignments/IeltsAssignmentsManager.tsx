"use client";

/**
 * Teacher IELTS assignments surface (WS-5.3): the assign form plus the list of
 * this club's IELTS-mock assignments, each linking to its per-student results.
 * Archiving runs through the `archiveIeltsAssignment` server action.
 */
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { archiveIeltsAssignment } from "@/app/actions/ielts/assignments";
import type { IeltsMockAssignmentRow } from "@/lib/api/ielts/assignments-repository";
import type { AssignableClass, AssignableTest } from "@/lib/api/ielts/assignment-manager-page";
import { IeltsAssignForm } from "./IeltsAssignForm";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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
}: {
  clubId: string;
  clubName: string;
  classes: AssignableClass[];
  tests: AssignableTest[];
  assignments: IeltsMockAssignmentRow[];
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
