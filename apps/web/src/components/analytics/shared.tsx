"use client";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type {
  ReportingPeriod,
  CriterionSummary,
} from "@/lib/analytics/contracts";
import { SKILL_LABELS } from "@/lib/analytics/class-rollup";
export type AnalyticsLocale = "en" | "vi";
export function number(
  value: number | null,
  locale: AnalyticsLocale,
  digits = 1,
) {
  return value === null
    ? "—"
    : new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(
        value,
      );
}
export function PeriodSelect({
  days,
  onChange,
  locale,
}: {
  days: 7 | 30 | 90;
  onChange: (days: 7 | 30 | 90) => void;
  locale: AnalyticsLocale;
}) {
  return (
    <Select
      aria-label={locale === "vi" ? "Khoảng thời gian" : "Reporting period"}
      value={days}
      onChange={(event) => onChange(Number(event.target.value) as 7 | 30 | 90)}
      className="h-8 py-1 type-label"
    >
      {([7, 30, 90] as const).map((value) => (
        <option key={value} value={value}>
          {value} {locale === "vi" ? "ngày" : "days"}
        </option>
      ))}
    </Select>
  );
}
export function PeriodLabel({
  period,
  locale,
}: {
  period: ReportingPeriod;
  locale: AnalyticsLocale;
}) {
  const format = new Intl.DateTimeFormat(locale, {
    timeZone: period.timezone,
    dateStyle: "medium",
  });
  return (
    <span>
      {format.format(new Date(period.start))} –{" "}
      {format.format(new Date(period.end))} · {period.timezone}
    </span>
  );
}
export function AnalyticsSection({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="min-w-0 border-t border-outline-variant py-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="type-title text-on-surface">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
export function AnalyticsStatus({
  loading,
  retry,
  locale,
}: {
  loading?: boolean;
  retry?: () => void;
  locale: AnalyticsLocale;
}) {
  return (
    <div
      className="py-8 type-body text-on-surface-variant"
      role={loading ? "status" : "alert"}
      aria-busy={loading || undefined}
    >
      <p>
        {loading
          ? locale === "vi"
            ? "Đang tải phân tích…"
            : "Loading analytics…"
          : locale === "vi"
            ? "Phân tích chưa khả dụng. Dữ liệu chưa được hiển thị."
            : "Analytics are unavailable. No data was displayed."}
      </p>
      {retry && (
        <Button className="mt-3" variant="outline" onClick={retry}>
          {locale === "vi" ? "Thử lại" : "Retry"}
        </Button>
      )}
    </div>
  );
}
export function CriteriaTable({
  rows,
  locale,
}: {
  rows: readonly CriterionSummary[];
  locale: AnalyticsLocale;
}) {
  const vi = locale === "vi";
  return (
    <div
      className="max-w-full overflow-x-auto"
      tabIndex={0}
      role="region"
      aria-label={vi ? "Bảng tiêu chí" : "Criterion table"}
    >
      <table className="w-full min-w-[680px] type-body">
        <thead>
          <tr className="border-b border-outline-variant text-left type-caption text-on-surface-variant">
            {[
              vi ? "Tiêu chí" : "Criterion",
              vi ? "Điểm trung bình" : "Mean band",
              vi ? "Học viên / độ phủ" : "Learners / coverage",
              vi ? "AI tạm thời" : "AI provisional",
              vi ? "AI kiểm định" : "AI adjudicated",
              vi ? "Giáo viên xác nhận" : "Teacher confirmed",
            ].map((label) => (
              <th key={label} scope="col" className="px-3 py-2 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr
              key={`${item.skill}:${item.task}:${item.criterion}`}
              className="border-b border-outline-variant"
            >
              <th
                scope="row"
                className="px-3 py-3 text-left font-normal text-on-surface"
              >
                <span className="block type-caption text-on-surface-variant">
                  {SKILL_LABELS[item.skill][locale]}
                  {item.task &&
                    ` · ${vi ? "Bài viết" : "Task"} ${item.task === "task1" ? 1 : 2}`}
                </span>
                {item.label[locale]}
              </th>
              <td className="px-3 py-3 tabular-nums">
                {number(item.meanBand, locale, 2)}
              </td>
              <td className="px-3 py-3 tabular-nums">
                {item.learnerCount} · {number(item.coverage * 100, locale)}%
              </td>
              <td className="px-3 py-3 tabular-nums">
                {item.provenance.aiProvisional}
              </td>
              <td className="px-3 py-3 tabular-nums">
                {item.provenance.aiAdjudicated}
              </td>
              <td className="px-3 py-3 tabular-nums">
                {item.provenance.teacherConfirmed}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="py-3 type-body text-on-surface-variant">
          {vi ? "Chưa có bằng chứng tiêu chí." : "No criterion evidence yet."}
        </p>
      )}
    </div>
  );
}
