"use client";

/**
 * Teacher per-assignment results (WS-5.3): completion headline + a per-student
 * band table for one IELTS-mock assignment. Read-only; all data is loaded
 * server-side and passed in.
 */
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft } from "@/components/ui/icons";
import { bandText } from "@/components/ielts/results/format";
import type { AssignmentResults, StudentAssignmentResult } from "@/lib/api/ielts/assignment-results-repository";
import { ASSIGNMENT_STATE_PILL } from "./state-pill";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-3">
      <p className="type-caption text-on-surface-variant">{label}</p>
      <p className="type-title text-on-surface">{value}</p>
    </div>
  );
}

function StudentRow({ student }: { student: StudentAssignmentResult }) {
  const t = useTranslations("ielts.assignments");
  return (
    <tr className="border-t border-outline-variant/40">
      <td className="sticky left-0 z-10 bg-surface px-3 py-2">
        <p className="font-semibold text-on-surface">{student.displayName}</p>
        {student.email ? <p className="text-xs text-on-surface-variant">{student.email}</p> : null}
      </td>
      <td className="px-3 py-2 text-center font-bold text-on-surface">
        {bandText(student.overallBand)}
      </td>
      <td className="px-3 py-2 text-center text-on-surface-variant">{bandText(student.listeningBand)}</td>
      <td className="px-3 py-2 text-center text-on-surface-variant">{bandText(student.readingBand)}</td>
      <td className="px-3 py-2 text-center text-on-surface-variant">{bandText(student.writingBand)}</td>
      <td className="px-3 py-2 text-center text-on-surface-variant">{bandText(student.speakingBand)}</td>
      <td className="px-3 py-2 text-center">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${ASSIGNMENT_STATE_PILL[student.state]}`}
        >
          {t(`state.${student.state}`)}
        </span>
      </td>
    </tr>
  );
}

export function IeltsAssignmentResultsView({
  clubId,
  results,
}: {
  clubId: string;
  results: AssignmentResults;
}) {
  const t = useTranslations("ielts.assignments");
  const { assignment, summary, students } = results;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link
          href={`/dashboard/clubs/${clubId}/ielts`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("results.backToAssignments")}
        </Link>
        <h1 className="type-heading-lg text-on-surface">{assignment.title}</h1>
        <p className="type-body-sm text-on-surface-variant">
          {assignment.classTitle ?? "—"} · {assignment.testTitle ?? ""}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={t("results.summaryTotal")} value={summary.total} />
        <Stat label={t("results.summaryCompleted")} value={summary.completed} />
        <Stat label={t("results.summarySubmitted")} value={summary.submitted} />
        <Stat label={t("results.summaryInProgress")} value={summary.inProgress} />
        <Stat label={t("results.summaryNotStarted")} value={summary.notStarted} />
        <Stat label={t("results.summaryAverage")} value={bandText(summary.averageBand)} />
      </div>

      <section className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface shadow-token-card">
        {students.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-on-surface-variant">
            {t("results.emptyRoster")}
          </p>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-surface-container text-xs uppercase tracking-wide text-on-surface-variant">
              <tr>
                <th className="sticky left-0 z-10 bg-surface-container px-3 py-2 text-left">
                  {t("results.student")}
                </th>
                <th className="px-3 py-2 text-center">{t("results.overall")}</th>
                <th className="px-3 py-2 text-center">{t("results.listening")}</th>
                <th className="px-3 py-2 text-center">{t("results.reading")}</th>
                <th className="px-3 py-2 text-center">{t("results.writing")}</th>
                <th className="px-3 py-2 text-center">{t("results.speaking")}</th>
                <th className="px-3 py-2 text-center">{t("results.statusColumn")}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <StudentRow key={student.userId} student={student} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
