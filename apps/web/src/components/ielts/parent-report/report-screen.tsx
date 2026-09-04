"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, type CSSProperties } from "react";
import { getThinkfyWebCssVariables } from "@thinkfy/shared/design-system";
import { useCspNonce } from "@/components/shared/theme-provider";
import { useRouter } from "@/i18n/navigation";
import { PageContainer } from "@/components/shared/product-layout";
import { Button } from "@/components/ui/button";
import { downloadExportFile } from "@/lib/export/download";
import { reportMonthOptions } from "@/lib/ielts/parent-report/request";
import {
  type ParentBandReport,
  type ParentReportRoster,
  type ReportLocale,
} from "@/lib/ielts/parent-report/contract";
import { PARENT_REPORT_COPY, formatMonth } from "./copy";
import { ReportSelect } from "./ReportSelect";
import styles from "./parent-report.module.css";

import {
  ParentBandReportView,
  defaultMetric,
  type Metric,
} from "./report-view";
// Reuse the canonical light theme for the whole printed page, including its margins.
const lightPrintTheme = `@media print { :root:has(body > [data-parent-report-print-root]) { ${Object.entries(
  getThinkfyWebCssVariables("light"),
)
  .map(([key, value]) => `${key}:${value};`)
  .join("")} color-scheme: light !important; } }`;

type ReportAction = (input: {
  classId: string;
  studentId: string;
  month: string;
}) => Promise<ParentBandReport>;
type ExportAction = (input: {
  classId: string;
  studentId: string;
  month: string;
  locale: ReportLocale;
  nextSteps?: string[];
}) => Promise<{
  report: ParentBandReport;
  payload: { filename: string; mimeType: string; base64: string };
}>;
export function ParentBandReportScreen({
  initialReport,
  roster,
  locale,
  getReport,
  exportReport,
}: {
  initialReport: ParentBandReport;
  roster: ParentReportRoster;
  locale: ReportLocale;
  getReport: ReportAction;
  exportReport: ExportAction;
}) {
  const router = useRouter();
  const nonce = useCspNonce();
  const [report, setReport] = useState(initialReport);
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [metric, setMetric] = useState<Metric>(defaultMetric(initialReport));
  const c = PARENT_REPORT_COPY[locale];
  useEffect(() => {
    setMounted(true);
  }, []);
  const cleanSteps = nextSteps.map((step) => step.trim()).filter(Boolean);
  const viewProps = {
    report,
    locale,
    nextSteps: cleanSteps.length ? cleanSteps : undefined,
    chartMetric: metric,
  };
  const destination = (studentId: string, month: string) =>
    `/dashboard/teacher/classes/${report.context.classId}/reports/${studentId}?month=${month}`;

  async function load(studentId: string, month: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await getReport({
        classId: report.context.classId,
        studentId,
        month,
      });
      setReport(next);
      setMetric(defaultMetric(next));
      setNextSteps([]);
      setEditing(false);
      router.replace(destination(studentId, month));
    } catch {
      setError(
        locale === "vi"
          ? "Không thể tải báo cáo. Vui lòng thử lại."
          : "The report could not be loaded. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function print() {
    if (busy) return;
    setBusy(true);
    try {
      await document.fonts.ready;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      window.print();
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await exportReport({
        classId: report.context.classId,
        studentId: report.context.studentId,
        month: report.period.month,
        locale,
        nextSteps: cleanSteps.length ? cleanSteps : undefined,
      });
      setReport(result.report);
      downloadExportFile(result.payload);
    } catch {
      setError(
        locale === "vi"
          ? "Không thể tải bảng tính. Vui lòng thử lại."
          : "The spreadsheet could not be downloaded. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full bg-background" aria-busy={busy}>
      <PageContainer
        size="focused"
        className={`${styles.noPrint} space-y-3 pb-0`}
      >
        <div className="grid min-w-0 gap-2 sm:grid-cols-3">
          <ReportSelect
            label={c.student}
            value={report.context.studentId}
            options={roster.students.map((student) => ({
              value: student.id,
              label: student.name,
            }))}
            onChange={(value) => void load(value, report.period.month)}
            disabled={busy}
          />
          <ReportSelect
            label={c.month}
            value={report.period.month}
            options={reportMonthOptions(
              new Date(report.generatedAt),
              report.period.timeZone,
            ).map((month) => ({
              value: month,
              label: formatMonth(month, locale),
            }))}
            onChange={(value) => void load(report.context.studentId, value)}
            disabled={busy}
          />
          <ReportSelect
            label={locale === "vi" ? "Ngôn ngữ" : "Language"}
            value={locale}
            options={[
              { value: "vi", label: "Tiếng Việt" },
              { value: "en", label: "English" },
            ]}
            onChange={(value) =>
              router.replace(
                destination(report.context.studentId, report.period.month),
                { locale: value },
              )
            }
            disabled={busy}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || !mounted}
            variant="primary"
            onClick={() => void print()}
          >
            {c.print}
          </Button>
          <Button
            disabled={busy}
            variant="outline"
            onClick={() => void download()}
          >
            {c.xlsx}
          </Button>
          <Button
            disabled={busy}
            variant="ghost"
            onClick={() => setEditing(!editing)}
          >
            {locale === "vi" ? "Sửa kế hoạch luyện tập" : "Edit practice plan"}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="type-body text-error">
            {error}
          </p>
        ) : null}
        {editing ? (
          <div className="space-y-3">
            <p className="type-caption text-on-surface-variant">
              {c.sessionOnly} {c.saveHint}
            </p>
            {[0, 1].map((index) => (
              <label key={index} className="block space-y-1 type-label">
                {locale === "vi" ? "Nội dung" : "Step"} {index + 1}
                <textarea
                  disabled={busy}
                  value={nextSteps[index] ?? ""}
                  maxLength={180}
                  onChange={(event) =>
                    setNextSteps((current) => [
                      index === 0 ? event.target.value : (current[0] ?? ""),
                      index === 1 ? event.target.value : (current[1] ?? ""),
                    ])
                  }
                  className="block min-h-16 w-full resize-y rounded-control border border-outline-variant bg-surface px-3 py-2 type-body text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
                />
              </label>
            ))}
          </div>
        ) : null}
      </PageContainer>
      <ParentBandReportView {...viewProps} onChartMetricChange={setMetric} />
      {mounted
        ? createPortal(
            <div
              data-parent-report-print-root
              className={styles.printRoot}
              style={getThinkfyWebCssVariables("light") as CSSProperties}
            >
              <style nonce={nonce}>{lightPrintTheme}</style>
              <ParentBandReportView {...viewProps} />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
