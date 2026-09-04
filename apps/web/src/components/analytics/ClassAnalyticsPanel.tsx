"use client";
import "./analytics-print.css";
import {
  useEffect,
  useSyncExternalStore,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Bar,
  BarChart,
  BarXAxis,
  ChartTooltip,
  Grid,
} from "@/components/charts";
import { ChartCard, ChartEmpty } from "@/components/data-viz";
import {
  getClassAnalyticsAction,
  exportPostMockReportAction,
} from "@/app/actions/admin-classes";
import { downloadExportFile } from "@/lib/export/download";
import {
  ANALYTICS_SKILLS,
  SKILL_LABELS,
  buildPostMockReport,
} from "@/lib/analytics/class-rollup";
import type {
  ClassAnalytics,
  IeltsSkill,
  LearnerAttention,
  SmartGroupBand,
} from "@/lib/analytics/contracts";
import {
  AnalyticsSection,
  AnalyticsStatus,
  CriteriaTable,
  number,
  PeriodLabel,
  PeriodSelect,
  type AnalyticsLocale,
} from "./shared";
import { PostMockReportView } from "./PostMockReportView";

export function ClassAnalyticsPanel({
  classId,
  locale = "en",
}: {
  classId: string;
  locale?: AnalyticsLocale;
}) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data?: ClassAnalytics;
    error?: boolean;
  }>({ key: "" });
  const key = `${classId}:${days}:${version}`;
  useEffect(() => {
    let current = true;
    getClassAnalyticsAction({ classId, days })
      .then((result) => {
        if (current)
          setState(
            result.ok ? { key, data: result.data } : { key, error: true },
          );
      })
      .catch(() => {
        if (current) setState({ key, error: true });
      });
    return () => {
      current = false;
    };
  }, [classId, days, key]);
  return (
    <section className="mt-5 min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="type-heading-md text-on-surface">
          {locale === "vi" ? "Phân tích lớp học" : "Class analytics"}
        </h2>
        <PeriodSelect days={days} onChange={setDays} locale={locale} />
      </div>
      {state.key !== key ? (
        <AnalyticsStatus loading locale={locale} />
      ) : state.error || !state.data ? (
        <AnalyticsStatus
          locale={locale}
          retry={() => setVersion((value) => value + 1)}
        />
      ) : (
        <ClassAnalyticsView key={key} report={state.data} locale={locale} />
      )}
    </section>
  );
}
const groupLabels: Record<SmartGroupBand, { en: string; vi: string }> = {
  "below-5": { en: "Below band 5", vi: "Dưới band 5" },
  "5-5.5": { en: "Band 5–5.5", vi: "Band 5–5,5" },
  "6-6.5": { en: "Band 6–6.5", vi: "Band 6–6,5" },
  "7-plus": { en: "Band 7+", vi: "Band 7 trở lên" },
};
function reasonText(
  reason: LearnerAttention["reasons"][number],
  locale: AnalyticsLocale,
) {
  const labels = {
    overdue_assignment: { en: "overdue assignments", vi: "bài tập quá hạn" },
    critical_weakness: {
      en: "critical demonstrated weaknesses",
      vi: "điểm yếu cần ưu tiên",
    },
    repeated_absence: { en: "recorded absences", vi: "buổi vắng đã ghi nhận" },
  };
  const detail = reason.details?.map((item) => item[locale]).join(", ");
  return `${reason.count} ${labels[reason.code][locale]}${detail ? ` · ${detail}` : ""}`;
}
const subscribeMounted = () => () => {};

export function ClassAnalyticsView({
  report,
  locale,
}: {
  report: ClassAnalytics;
  locale: AnalyticsLocale;
}) {
  const vi = locale === "vi";
  const [skill, setSkill] = useState<IeltsSkill>("writing");
  const [assessmentId, setAssessmentId] = useState(
    report.assessments[0]?.assessmentId ?? "",
  );
  const [exportError, setExportError] = useState(false);
  const [exporting, startExport] = useTransition();
  const mounted = useSyncExternalStore(
    subscribeMounted,
    () => true,
    () => false,
  );
  const post = buildPostMockReport(report, assessmentId);
  const selectedSkill = report.skillSummaries.find(
    (item) => item.skill === skill,
  )!;
  const empty = vi
    ? "Chưa có bằng chứng trong khoảng thời gian này."
    : "No evidence in this period.";
  const hasPost = Boolean(post);
  useEffect(() => {
    if (!hasPost) return;
    const root = document.documentElement;
    let dark = false;
    let scheme = "";
    let printing = false;
    const beforePrint = () => {
      if (printing) return;
      printing = true;
      dark = root.classList.contains("dark");
      scheme = root.style.colorScheme;
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    };
    const afterPrint = () => {
      if (!printing) return;
      printing = false;
      root.classList.toggle("dark", dark);
      root.style.colorScheme = scheme;
    };
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
      afterPrint();
    };
  }, [hasPost]);
  function exportReport(format: "xlsx" | "csv") {
    setExportError(false);
    startExport(async () => {
      try {
        const result = await exportPostMockReportAction({
          classId: report.classId,
          assignmentId: assessmentId,
          days: report.period.days,
          locale,
          format,
        });
        if (result.ok) downloadExportFile(result.data);
        else setExportError(true);
      } catch {
        setExportError(true);
      }
    });
  }
  return (
    <div
      className="min-w-0 text-on-surface"
      data-testid="class-analytics-panel"
    >
      <p className="mb-4 type-caption text-on-surface-variant">
        <PeriodLabel period={report.period} locale={locale} /> ·{" "}
        {report.coverage.learnerCount}/{report.coverage.totalLearners}{" "}
        {vi ? "học viên có bằng chứng" : "learners with evidence"}
      </p>
      <AnalyticsSection
        title={vi ? "Nội dung cần dạy lại" : "What to reteach next"}
      >
        {report.reteachPriorities.length ? (
          <ol className="divide-y divide-outline-variant">
            {report.reteachPriorities.map((item) => (
              <li
                key={`${item.source}:${item.subskill}`}
                className="flex flex-wrap items-start justify-between gap-2 py-3"
              >
                <div className="min-w-0">
                  <p className="type-body">
                    {item.label?.[locale] ?? SKILL_LABELS[item.skill][locale]}
                  </p>
                  <p className="mt-1 type-caption text-on-surface-variant">
                    {item.source === "learner-wide"
                      ? vi
                        ? "Bằng chứng từ kế hoạch học cá nhân"
                        : "Learner-wide study-plan evidence"
                      : vi
                        ? "Chênh lệch tiêu chí trong bài đánh giá"
                        : "Relative criterion gap in assessments"}
                  </p>
                </div>
                <span className="type-label">
                  {item.affectedLearners} {vi ? "học viên" : "learners"}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="type-body text-on-surface-variant">{empty}</p>
        )}
        {report.sources.subskills === "unavailable" && (
          <p role="status" className="mt-3 type-caption text-warning">
            {vi
              ? "Bằng chứng kỹ năng nhỏ chưa khả dụng; đề xuất chỉ dựa trên bài đánh giá."
              : "Subskill evidence is unavailable; suggestions use assessment criteria only."}
          </p>
        )}
      </AnalyticsSection>
      <AnalyticsSection
        title={vi ? "Học viên cần chú ý" : "Who needs attention"}
      >
        {report.attention.length ? (
          <ul className="divide-y divide-outline-variant">
            {report.attention.map((learner) => (
              <li
                key={learner.learnerId}
                className="flex flex-wrap items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="type-body font-medium">{learner.displayName}</p>
                  <p className="mt-1 type-caption text-on-surface-variant">
                    {learner.reasons
                      .map((reason) => reasonText(reason, locale))
                      .join(" · ")}
                  </p>
                </div>
                <Link
                  className="type-label text-primary underline-offset-4 hover:underline"
                  href={`/${locale}/dashboard/teacher/classes/${report.classId}?workbenchTab=${learner.reasons[0].code === "overdue_assignment" ? "assignments" : "gradebook"}`}
                >
                  {vi ? "Mở lớp học" : "Open class workbench"}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-body text-on-surface-variant">
            {vi
              ? "Không có tín hiệu cần ưu tiên."
              : "No priority signals recorded."}
          </p>
        )}
        {report.insufficientEvidence.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer type-label text-on-surface-variant">
              {vi ? "Chưa đủ bằng chứng" : "Insufficient evidence"} ·{" "}
              {report.insufficientEvidence.length}
            </summary>
            <ul className="mt-2 space-y-1 type-body">
              {report.insufficientEvidence.map((learner) => (
                <li key={learner.learnerId}>{learner.displayName}</li>
              ))}
            </ul>
          </details>
        )}
      </AnalyticsSection>
      <AnalyticsSection
        title={vi ? "Mức độ thành thạo" : "Class mastery"}
        action={
          <Select
            aria-label={vi ? "Kỹ năng" : "Skill"}
            value={skill}
            onChange={(event) => setSkill(event.target.value as IeltsSkill)}
            className="h-8 py-1 type-label"
          >
            {ANALYTICS_SKILLS.map((value) => (
              <option key={value} value={value}>
                {SKILL_LABELS[value][locale]}
              </option>
            ))}
          </Select>
        }
      >
        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {report.skillSummaries.map((item) => (
            <div key={item.skill}>
              <p className="type-label text-on-surface-variant">
                {item.label[locale]}
              </p>
              <p className="mt-1 type-heading-md">
                {number(item.meanBand, locale, 2)}
              </p>
              <p className="type-caption text-on-surface-variant">
                {item.learnerCount}/{report.coverage.totalLearners} ·{" "}
                {item.provisionalLearners} {vi ? "tạm thời" : "provisional"}
              </p>
            </div>
          ))}
        </div>
        <ChartCard
          title={`${SKILL_LABELS[skill][locale]} · ${vi ? "Phân bố band" : "Band distribution"}`}
          bodyClassName="h-56"
        >
          {selectedSkill.distribution.length ? (
            <BarChart
              data={selectedSkill.distribution.map((item) => ({
                ...item,
                label: number(item.band, locale),
              }))}
              xDataKey="label"
              aspectRatio="auto"
              className="h-full"
            >
              <Grid horizontal vertical={false} />
              <Bar dataKey="learners" fill="var(--chart-line-primary)" />
              <BarXAxis />
              <ChartTooltip showDatePill={false} />
            </BarChart>
          ) : (
            <ChartEmpty description={empty} />
          )}
        </ChartCard>
        <p className="my-3 type-caption text-on-surface-variant">
          {vi
            ? "AI kiểm định vẫn là ước tính AI, không phải giáo viên xác nhận. Các số nguồn tiêu chí có thể trùng nhau sau khi giáo viên xem lại."
            : "AI adjudication remains an AI estimate, not teacher confirmation. Criterion source counts may overlap after teacher review."}
        </p>
        <CriteriaTable rows={report.criterionSummaries} locale={locale} />
      </AnalyticsSection>
      <AnalyticsSection
        title={`${vi ? "Nhóm học đề xuất" : "Suggested teaching groups"} · ${SKILL_LABELS[skill][locale]}`}
      >
        <p className="mb-3 type-caption text-on-surface-variant">
          {vi
            ? "Theo điểm kỹ năng gần nhất; điểm AI vẫn là tạm thời. Nhóm chưa được lưu."
            : "Based on the latest demonstrated skill band; AI bands remain provisional. Groups are not saved."}
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {report.groups
            .filter((group) => group.skill === skill)
            .map((group, index) => (
              <li
                key={`${group.band}:${index}`}
                className="min-w-0 bg-surface-container-low p-3"
              >
                <p className="type-label">
                  {groupLabels[group.band][locale]}
                  {group.ungrouped
                    ? vi
                      ? " · Chưa ghép nhóm"
                      : " · Unmatched"
                    : ""}
                </p>
                <ul className="mt-2 space-y-1 type-body">
                  {group.learners.map((learner) => (
                    <li
                      key={learner.learnerId}
                      className="flex justify-between gap-2"
                    >
                      <span className="min-w-0 break-words">
                        {learner.displayName}
                      </span>
                      <span>{number(learner.band, locale)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
        </ul>
        {report.groupsMissingEvidence[skill].length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer type-label text-on-surface-variant">
              {vi
                ? "Chưa có điểm kỹ năng để ghép nhóm"
                : "No skill score for grouping"}{" "}
              · {report.groupsMissingEvidence[skill].length}
            </summary>
            <ul className="mt-2 space-y-1 type-body">
              {report.groupsMissingEvidence[skill].map((learner) => (
                <li key={learner.learnerId}>{learner.displayName}</li>
              ))}
            </ul>
          </details>
        )}
      </AnalyticsSection>
      <AnalyticsSection
        title={vi ? "Báo cáo sau bài thi thử" : "Post-mock class report"}
        action={
          report.assessments.length ? (
            <div className="max-w-full">
              <Select
                aria-label={vi ? "Bài đánh giá" : "Assessment"}
                value={assessmentId}
                onChange={(event) => setAssessmentId(event.target.value)}
                className="h-8 max-w-full py-1 type-label"
              >
                {report.assessments.map((item) => (
                  <option key={item.assessmentId} value={item.assessmentId}>
                    {item.title}
                  </option>
                ))}
              </Select>
            </div>
          ) : undefined
        }
      >
        {post ? (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={exporting}
                onClick={() => exportReport("xlsx")}
              >
                {exporting
                  ? vi
                    ? "Đang chuẩn bị…"
                    : "Preparing…"
                  : vi
                    ? "Xuất XLSX"
                    : "Export XLSX"}
              </Button>
              <Button
                variant="outline"
                disabled={exporting}
                onClick={() => exportReport("csv")}
              >
                {vi ? "Xuất CSV" : "Export CSV"}
              </Button>
              <Button variant="ghost" onClick={() => window.print()}>
                {vi ? "In báo cáo" : "Print report"}
              </Button>
            </div>
            {exportError && (
              <p role="alert" className="mb-3 type-body text-error">
                {vi
                  ? "Không thể xuất báo cáo. Vui lòng thử lại."
                  : "The report could not be exported. Try again."}
              </p>
            )}
            <PostMockReportView report={post} locale={locale} />
          </>
        ) : (
          <p className="type-body text-on-surface-variant">
            {vi
              ? "Chưa có bài thi thử trong khoảng thời gian này."
              : "No mock assessments in this period."}
          </p>
        )}
      </AnalyticsSection>
      {mounted &&
        post &&
        createPortal(
          <div id="b6-print-root" className="hidden">
            <PostMockReportView report={post} locale={locale} />
          </div>,
          document.body,
        )}
    </div>
  );
}
