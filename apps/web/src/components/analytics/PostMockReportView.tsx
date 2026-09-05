"use client";
import type { PostMockReport } from "@/lib/analytics/contracts";
import { SKILL_LABELS } from "@/lib/analytics/class-rollup";
import {
  CriteriaTable,
  number,
  PeriodLabel,
  type AnalyticsLocale,
} from "./shared";

/** This component accepts only the aggregate privacy projection. */
export function PostMockReportView({
  report,
  locale,
}: {
  report: PostMockReport;
  locale: AnalyticsLocale;
}) {
  const vi = locale === "vi";
  return (
    <article data-b6-print-report className="min-w-0 space-y-5 text-on-surface">
      <header>
        <h3 className="type-heading-md">{report.title}</h3>
        <p className="mt-1 type-body">{report.classTitle}</p>
        <p className="mt-1 type-caption text-on-surface-variant">
          <PeriodLabel period={report.period} locale={locale} />
        </p>
      </header>
      <p className="type-body">
        {vi ? "Đã nộp" : "Submitted"}: {report.submittedLearners}/
        {report.rosterCount} ·{" "}
        {vi ? "Có điểm tạm thời" : "With provisional scores"}:{" "}
        {report.provisionalCount}
      </p>
      <div className="max-w-full overflow-x-auto">
        <table className="w-full type-body">
          <thead>
            <tr className="border-b border-outline-variant text-left type-caption text-on-surface-variant">
              <th className="py-2">{vi ? "Kỹ năng" : "Skill"}</th>
              <th className="py-2">{vi ? "Điểm" : "Band"}</th>
              <th className="py-2">{vi ? "Độ phủ" : "Coverage"}</th>
              <th className="py-2">{vi ? "Tạm thời" : "Provisional"}</th>
            </tr>
          </thead>
          <tbody>
            {report.skillSummaries.map((item) => (
              <tr key={item.skill} className="border-b border-outline-variant">
                <th scope="row" className="py-2 text-left font-normal">
                  {item.label[locale]}
                </th>
                <td className="py-2 tabular-nums">
                  {number(item.meanBand, locale, 2)}
                </td>
                <td className="py-2">
                  {item.learnerCount}/{report.rosterCount}
                </td>
                <td className="py-2">{item.provisionalLearners}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          {
            title: vi ? "Điểm mạnh tương đối" : "Relative strengths",
            rows: report.strengths,
          },
          {
            title: vi ? "Cần cải thiện tương đối" : "Relative gaps",
            rows: report.gaps,
          },
        ]
          .map((item, index) => ({
            ...item,
            rows: index === 1 ? report.gaps : (item.rows ?? []),
          }))
          .map((item) => (
            <section key={item.title}>
              <h4 className="type-title">{item.title}</h4>
              {item.rows.length ? (
                <ul className="mt-2 space-y-1 type-body">
                  {item.rows.map((row) => (
                    <li key={row.skill}>
                      {SKILL_LABELS[row.skill][locale]} ·{" "}
                      {number(row.meanBand, locale, 2)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 type-body text-on-surface-variant">
                  {vi
                    ? "Chưa có khác biệt rõ rệt."
                    : "No distinct difference yet."}
                </p>
              )}
            </section>
          ))}
      </div>
      <CriteriaTable rows={report.criterionSummaries} locale={locale} />
      <section>
        <h4 className="type-title">
          {vi ? "Nội dung cần dạy lại" : "Next teaching steps"}
        </h4>
        {report.nextSteps.length ? (
          <ul className="mt-2 space-y-2 type-body">
            {report.nextSteps.map((step) => (
              <li key={`${step.skill}:${step.criterion}`}>
                {step.label[locale]} · {step.affectedLearners}{" "}
                {vi ? "học viên" : "learners"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 type-body text-on-surface-variant">
            {vi
              ? "Cần thêm bằng chứng để đề xuất nội dung."
              : "More evidence is needed to suggest a topic."}
          </p>
        )}
      </section>
      <p className="type-caption text-on-surface-variant">
        {report.methodology[locale]}
      </p>
    </article>
  );
}
