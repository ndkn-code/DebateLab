"use client";
import { PageContainer } from "@/components/shared/product-layout";
import { BandHistoryChart } from "@/components/charts";
import {
  REPORT_SKILLS,
  type ParentBandReport,
  type ReportLocale,
  type ReportSkill,
} from "@/lib/ielts/parent-report/contract";
import { latestReportCriterionGroup } from "@/lib/ielts/parent-report/model";
import { PARENT_REPORT_COPY, formatDate, formatMonth } from "./copy";
import { ReportSelect } from "./ReportSelect";
import styles from "./parent-report.module.css";
export type Metric = "overall" | ReportSkill;
const bandText = (band: number | null) =>
  band === null ? "–" : band.toFixed(1);

export function defaultMetric(report: ParentBandReport): Metric {
  if (report.trajectory.some((item) => item.overall !== null)) return "overall";
  return (
    REPORT_SKILLS.find((skill) =>
      report.trajectory.some((item) => item.skills[skill] !== null),
    ) ?? "overall"
  );
}

function OverallSummary({
  report,
  locale,
}: {
  report: ParentBandReport;
  locale: ReportLocale;
}) {
  const c = PARENT_REPORT_COPY[locale];
  const assessment = report.headlineAssessment;
  const explanation = !assessment
    ? c.noData
    : assessment.overallState === "missing_skills"
      ? locale === "vi"
        ? "Chưa đủ kết quả của 4 kỹ năng."
        : "Results for all four skills are not available yet."
      : assessment.overallState === "awaiting_confirmation"
        ? locale === "vi"
          ? "Chưa có kết quả tổng hợp được xác nhận."
          : "A confirmed overall result is not available yet."
        : null;
  return (
    <section className={styles.scoreGrid} aria-label={c.skills}>
      <div className="space-y-2 border-l-2 border-primary pl-4">
        <h2 className="type-label text-on-surface-variant">
          {c.latest} · {c.overall}
        </h2>
        <p className="type-heading-xl text-on-surface">
          {bandText(assessment?.overall ?? null)}
        </p>
        {explanation ? (
          <p className="type-caption text-on-surface-variant">{explanation}</p>
        ) : null}
        {assessment ? (
          <p className="type-caption text-on-surface-variant">
            {formatDate(assessment.submittedAt, locale, report.period.timeZone)}
            <br />
            {c.source[assessment.source]}
          </p>
        ) : null}
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3">
        {report.skills.map((item) => (
          <div key={item.skill} className="min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="type-label">{c.skill[item.skill]}</h3>
              <p className="type-heading-md">{bandText(item.band)}</p>
            </div>
            <p className="type-caption text-on-surface-variant">
              {item.assessedAt
                ? formatDate(item.assessedAt, locale, report.period.timeZone)
                : c.missing}
              <br />
              {c.source[item.source]}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CriteriaGroup({
  report,
  skill,
  locale,
}: {
  report: ParentBandReport;
  skill: "writing" | "speaking";
  locale: ReportLocale;
}) {
  const c = PARENT_REPORT_COPY[locale];
  const selected = latestReportCriterionGroup(report.criteria, skill);
  const first = selected[0];
  return (
    <section className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <h2 className="type-title text-on-surface">{c.skill[skill]}</h2>
        {first ? (
          <p className="type-caption text-on-surface-variant">
            {skill === "writing"
              ? locale === "vi"
                ? "Bài"
                : "Task"
              : locale === "vi"
                ? "Phần"
                : "Part"}{" "}
            {first.slot} ·{" "}
            {formatDate(first.assessedAt, locale, report.period.timeZone)}
          </p>
        ) : null}
      </div>
      {selected.length ? (
        <dl>
          {selected.map((item) => (
            <div
              key={item.key}
              className="flex items-start justify-between gap-3 border-b border-outline-variant py-2 last:border-b-0 print:py-1"
            >
              <dt className="min-w-0 type-label text-on-surface-variant">
                {item.label[locale]}
                <span className="block type-caption">
                  {c.source[item.source]}
                </span>
              </dt>
              <dd className="shrink-0 type-title text-on-surface">
                {bandText(item.band)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="type-body text-on-surface-variant">{c.noData}</p>
      )}
    </section>
  );
}

function AttendanceSummary({
  report,
  locale,
}: {
  report: ParentBandReport;
  locale: ReportLocale;
}) {
  const c = PARENT_REPORT_COPY[locale];
  const att = report.attendance;
  return (
    <section className="space-y-2 border-t border-outline-variant pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="type-title">{c.attendance}</h2>
        <p className="type-title">
          {att.rate === null ? c.noScore : `${Math.round(att.rate * 100)}%`}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-2 type-label sm:grid-cols-4">
        {(
          [
            [c.present, att.present],
            [c.late, att.late],
            [c.absent, att.absent],
            [c.unmarked, att.unmarked],
          ] as const
        ).map(([label, count]) => (
          <div
            key={label}
            className="flex justify-between gap-2 sm:flex-col sm:gap-1"
          >
            <dt className="text-on-surface-variant">{label}</dt>
            <dd>{count}</dd>
          </div>
        ))}
      </dl>
      <p className="type-caption text-on-surface-variant">
        {locale === "vi"
          ? `Đã điểm danh ${att.markedSessions}/${att.recordedSessions} buổi có dữ liệu. Tỷ lệ tính trên buổi đã điểm danh; chưa xác nhận toàn bộ lịch học.`
          : `${att.markedSessions}/${att.recordedSessions} recorded sessions marked. Rate uses marked sessions; full timetable coverage is not confirmed.`}
      </p>
    </section>
  );
}

function ReportFooter({
  report,
  locale,
}: {
  report: ParentBandReport;
  locale: ReportLocale;
}) {
  const c = PARENT_REPORT_COPY[locale];
  return (
    <footer className="border-t border-outline-variant pt-3 type-caption text-on-surface-variant">
      <p>{c.scoreBasis}</p>
      <p>
        {c.updated}:{" "}
        {formatDate(report.generatedAt, locale, report.period.timeZone)} ·{" "}
        {report.period.timeZone}
      </p>
      {report.availability.pendingCount > 0 ? (
        <p>
          {report.availability.pendingCount} {c.pending}
        </p>
      ) : null}
    </footer>
  );
}

export function ParentBandReportView({
  report,
  locale,
  nextSteps,
  chartMetric,
  onChartMetricChange,
}: {
  report: ParentBandReport;
  locale: ReportLocale;
  nextSteps?: string[];
  chartMetric?: Metric;
  onChartMetricChange?: (metric: Metric) => void;
}) {
  const c = PARENT_REPORT_COPY[locale];
  const metric = chartMetric ?? defaultMetric(report);
  const chartLabel = metric === "overall" ? c.overall : c.skill[metric];
  const points = report.trajectory.map((assessment) => ({
    date: assessment.submittedAt,
    value:
      metric === "overall" ? assessment.overall : assessment.skills[metric],
  }));
  const steps =
    nextSteps
      ?.map((step) => step.trim())
      .filter(Boolean)
      .slice(0, 2) ?? report.nextFocus.map((step) => step.text[locale]);
  return (
    <article
      className={`${styles.reportPaper} text-on-surface`}
      data-parent-report
    >
      <PageContainer size="focused" className={styles.reportBody}>
        <header className="space-y-3 border-b border-outline-variant pb-4">
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 type-label text-on-surface-variant">
            <p className="break-words">{report.context.centreName}</p>
            <p>
              {formatMonth(report.period.month, locale)}
              {report.period.isCurrentMonth
                ? locale === "vi"
                  ? " · đến hôm nay"
                  : " · month to date"
                : ""}
            </p>
          </div>
          <div>
            <p className="type-caption text-on-surface-variant">{c.title}</p>
            <h1 className="break-words type-heading-lg">
              {report.context.studentName}
            </h1>
            <p className="break-words type-label text-on-surface-variant">
              {report.context.className}
            </p>
          </div>
        </header>
        <OverallSummary report={report} locale={locale} />
        <section className="space-y-2" aria-label={c.trajectory}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="type-title">
              {c.trajectory} · {chartLabel}
            </h2>
            {onChartMetricChange ? (
              <div className={`${styles.noPrint} w-40`}>
                <ReportSelect
                  label={c.chooseSkill}
                  value={metric}
                  options={[
                    { value: "overall", label: c.overall },
                    ...REPORT_SKILLS.map((skill) => ({
                      value: skill,
                      label: c.skill[skill],
                    })),
                  ]}
                  onChange={(value) => onChartMetricChange(value as Metric)}
                />
              </div>
            ) : null}
          </div>
          <BandHistoryChart
            data={points}
            label={chartLabel}
            locale={locale}
            timeZone={report.period.timeZone}
          />
          <p className="type-caption text-on-surface-variant">
            {locale === "vi"
              ? "Các điểm là kết quả từng bài luyện tập trong 6 tháng; không phải dự đoán."
              : "Points show individual practice results over six months, not predictions."}
          </p>
          <dl className="sr-only">
            {points.map((point, index) => (
              <div key={index}>
                <dt>
                  {formatDate(point.date, locale, report.period.timeZone)}
                </dt>
                <dd>{bandText(point.value)}</dd>
              </div>
            ))}
          </dl>
        </section>
        <div className={styles.criteriaGrid}>
          <CriteriaGroup report={report} skill="writing" locale={locale} />
          <CriteriaGroup report={report} skill="speaking" locale={locale} />
        </div>
        {report.criteria.length > 8 ? (
          <p className="type-caption text-on-surface-variant">
            {locale === "vi"
              ? "Hiển thị một bài/phần gần nhất mỗi kỹ năng. Bảng tính có chi tiết tất cả các bài/phần đã chấm."
              : "Showing one recent task/part per skill. The spreadsheet includes all assessed tasks/parts."}
          </p>
        ) : null}
        <AttendanceSummary report={report} locale={locale} />
        <section className="space-y-2">
          <h2 className="type-title">
            {nextSteps?.length
              ? locale === "vi"
                ? "Kế hoạch luyện tập"
                : "Practice plan"
              : c.nextFocus}
          </h2>
          {steps.length ? (
            <ol className="list-decimal space-y-1 pl-5 type-body">
              {steps.map((step, index) => (
                <li key={index} className="break-words">
                  {step}
                </li>
              ))}
            </ol>
          ) : (
            <p className="type-body text-on-surface-variant">{c.noNextFocus}</p>
          )}
        </section>
        <ReportFooter report={report} locale={locale} />
      </PageContainer>
    </article>
  );
}
