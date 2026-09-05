"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bar,
  BarChart,
  BarXAxis,
  ChartTooltip,
  Grid,
} from "@/components/charts";
import { ChartCard } from "@/components/data-viz";
import { getCentreAnalyticsAction } from "@/app/actions/admin-classes";
import { estimateMarkingWorkload } from "@/lib/analytics/centre-rollup";
import type { CentreAnalytics } from "@/lib/analytics/contracts";
import {
  AnalyticsSection,
  AnalyticsStatus,
  number,
  PeriodLabel,
  PeriodSelect,
  type AnalyticsLocale,
} from "./shared";

export function CentreAnalyticsPanel({
  clubId,
  locale = "en",
}: {
  clubId: string;
  locale?: AnalyticsLocale;
}) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data?: CentreAnalytics;
    error?: boolean;
  }>({ key: "" });
  const key = `${clubId}:${days}:${version}`;
  useEffect(() => {
    let current = true;
    getCentreAnalyticsAction({ clubId, days })
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
  }, [clubId, days, key]);
  return (
    <section className="mt-6 min-w-0 border-t border-outline-variant pt-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="type-heading-md text-on-surface">
          {locale === "vi"
            ? "Mức sử dụng và giá trị giảng dạy"
            : "Usage and teaching value"}
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
        <CentreAnalyticsView key={key} data={state.data} locale={locale} />
      )}
    </section>
  );
}
const subscribeStorage = (listener: () => void) => {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
};
function storedMinutes(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw === null ? 20 : Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 120
      ? parsed
      : 20;
  } catch {
    return 20;
  }
}
export function CentreAnalyticsView({
  data,
  locale,
}: {
  data: CentreAnalytics;
  locale: AnalyticsLocale;
}) {
  const vi = locale === "vi";
  const [adjustment, setAdjustment] = useState<number | null>(null);
  const storageKey = `thinkfy:b6:marking-minutes:${data.viewerId ?? "preview"}:${data.clubId}`;
  const saved = useSyncExternalStore(
    subscribeStorage,
    () => storedMinutes(storageKey),
    () => 20,
  );
  const minutes = adjustment ?? saved;
  const estimate = estimateMarkingWorkload(
    data.markingWorkload.qualifyingResponses,
    minutes,
  );
  const ieltsAvailable = data.sources.ielts !== "unavailable";
  const unavailable = vi ? "Chưa khả dụng" : "Unavailable";
  function setMinutes(value: number) {
    if (!Number.isFinite(value)) return;
    const bounded = Math.min(120, Math.max(0, value));
    setAdjustment(bounded);
    if (data.viewerId) {
      try {
        window.localStorage.setItem(storageKey, String(bounded));
      } catch {
        /* This device can still use the estimate without persistence. */
      }
    }
  }
  const metrics = [
    {
      label: vi ? "Buổi học đã diễn ra" : "Sessions run",
      value: number(data.sessions, locale, 0),
    },
    {
      label: vi ? "Bài thi thử đã chấm" : "Mocks graded",
      value: ieltsAvailable
        ? number(data.mocksGraded.total, locale, 0)
        : unavailable,
    },
    {
      label: vi ? "Bài nộp đã có phản hồi" : "Submissions returned",
      value: number(data.turnedAroundRevisions.count, locale, 0),
    },
    {
      label: vi ? "Học viên hoạt động" : "Active learners",
      value: number(data.activeLearners, locale, 0),
    },
    {
      label: vi ? "Bài trả lời được AI chấm" : "AI grading delivered",
      value: ieltsAvailable
        ? number(data.uniqueAiResponses, locale, 0)
        : unavailable,
    },
  ];
  const names = new Map(
    data.classRows.map((row) => [row.classId, row.classTitle]),
  );
  return (
    <div
      className="min-w-0 text-on-surface"
      data-testid="centre-analytics-panel"
    >
      <p className="mb-4 type-caption text-on-surface-variant">
        <PeriodLabel period={data.period} locale={locale} />
      </p>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-4 border-y border-outline-variant py-4 lg:grid-cols-5">
        {metrics.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="type-label text-on-surface-variant">{item.label}</dt>
            <dd className="mt-2 break-words type-heading-md tabular-nums">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="my-3 flex flex-wrap gap-x-5 gap-y-2 type-caption text-on-surface-variant">
        <p>
          {vi ? "Thời gian phản hồi trung vị" : "Median turnaround"}:{" "}
          {number(data.turnedAroundRevisions.medianHours, locale)}{" "}
          {vi ? "giờ" : "hours"} · {data.coverage.feedbackWithKnownDuration}/
          {data.coverage.publishedFeedback}{" "}
          {vi ? "bài có đủ mốc thời gian" : "revisions with known timestamps"}
        </p>
        <p>
          {vi
            ? "Tồn đọng chưa phản hồi tính đến hôm nay"
            : "Outstanding feedback backlog as of today"}
          : {data.turnedAroundRevisions.pending}
        </p>
        {ieltsAvailable && (
          <p>
            {data.mocksGraded.confirmed}{" "}
            {vi ? "được giáo viên xác nhận" : "teacher-confirmed"} ·{" "}
            {data.mocksGraded.provisional} {vi ? "tạm thời" : "provisional"}
          </p>
        )}
      </div>
      {!ieltsAvailable && (
        <p role="status" className="my-3 type-caption text-warning">
          {vi
            ? "Dữ liệu IELTS chưa được bật cho tài khoản này; các chỉ số khác chỉ gồm hoạt động LMS."
            : "IELTS data is not enabled for this account; other metrics include LMS activity only."}
        </p>
      )}
      <AnalyticsSection
        title={
          vi
            ? "Khối lượng chấm bài ước tính đã hỗ trợ"
            : "Estimated marking workload covered"
        }
      >
        <div className="flex flex-wrap items-baseline gap-3">
          <p className="type-heading-lg tabular-nums">
            {ieltsAvailable ? number(estimate.hours, locale) : "—"}{" "}
            <span className="type-body">{vi ? "giờ" : "hours"}</span>
          </p>
          <p className="type-caption text-on-surface-variant">
            {vi
              ? "Ước tính khối lượng công việc, không phải thời gian thực tế tiết kiệm."
              : "Estimated workload, not measured net time saved."}
          </p>
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer type-label text-primary">
            {vi
              ? "Xem và điều chỉnh cách tính"
              : "See and adjust the calculation"}
          </summary>
          <div className="mt-3 space-y-3 type-body">
            <p>
              {data.markingWorkload.qualifyingResponses}{" "}
              {vi ? "bài viết Task 2 được AI chấm" : "AI-graded Task 2 essays"}{" "}
              × {number(minutes, locale)} {vi ? "phút" : "minutes"} ÷ 60 ={" "}
              {number(estimate.hours, locale)} {vi ? "giờ" : "hours"}
            </p>
            <label
              className="flex flex-wrap items-center gap-3 type-label"
              htmlFor={`minutes-${data.clubId}`}
            >
              {vi ? "Phút chấm mỗi bài viết" : "Marking minutes per essay"}
              <Input
                id={`minutes-${data.clubId}`}
                type="number"
                min={0}
                max={120}
                step={1}
                value={minutes}
                onChange={(event) => setMinutes(event.target.valueAsNumber)}
                className="h-8 w-24 type-body"
              />
            </label>
            <p className="type-caption text-on-surface-variant">
              {vi
                ? "Mặc định 20 phút là mức thấp trong ước tính 20–30 phút của một trang giảng dạy thương mại. Đây không phải số đo tại trung tâm. Điều chỉnh được nhớ trên thiết bị này cho tài khoản và trung tâm của bạn."
                : "The 20-minute default is the lower end of a commercial teaching site's 20–30 minute estimate. It is not a measurement at your centre. Adjustments are remembered on this device for your account and centre."}{" "}
              <a
                href="https://www.myenglishpages.com/ielts-writing-feedback-for-teachers/"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                {vi ? "Nguồn giả định" : "Assumption source"}
              </a>
            </p>
            <p className="type-caption text-on-surface-variant">
              {vi
                ? "Không tính Task 1, Nói, lần chấm lại hoặc bài chỉ do giáo viên chấm. Chưa đo thời gian giáo viên xem lại kết quả AI."
                : "Excludes Task 1, Speaking, regrading, and teacher-only grading. Teacher review of AI output is not timed."}
            </p>
            <Button variant="ghost" onClick={() => setMinutes(20)}>
              {vi ? "Khôi phục 20 phút" : "Reset to 20 minutes"}
            </Button>
          </div>
        </details>
      </AnalyticsSection>
      <ChartCard
        title={vi ? "Hoạt động theo ngày" : "Daily activity"}
        bodyClassName="h-56"
      >
        <BarChart
          data={data.dailyTrend}
          xDataKey="date"
          aspectRatio="auto"
          className="h-full"
        >
          <Grid horizontal vertical={false} />
          <Bar dataKey="sessions" fill="var(--chart-line-primary)" />
          {ieltsAvailable && (
            <Bar dataKey="aiResponses" fill="var(--chart-line-secondary)" />
          )}
          <BarXAxis />
          <ChartTooltip showDatePill={false} />
        </BarChart>
      </ChartCard>
      <p className="mt-2 type-caption text-on-surface-variant">
        {vi
          ? "Chuỗi 1: buổi học đã diễn ra. Chuỗi 2: bài trả lời được AI chấm."
          : "Series 1: sessions run. Series 2: AI-graded responses."}
      </p>
      <AnalyticsSection title={vi ? "Theo lớp" : "By class"}>
        <div
          className="max-w-full overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label={vi ? "Bảng lớp" : "Class table"}
        >
          <table className="w-full min-w-[480px] type-body">
            <thead>
              <tr className="border-b border-outline-variant text-left type-caption text-on-surface-variant">
                {[
                  vi ? "Lớp" : "Class",
                  vi ? "Buổi học" : "Sessions",
                  vi ? "Bài thi thử" : "Mocks graded",
                  vi ? "Học viên hoạt động" : "Active learners",
                ].map((label) => (
                  <th key={label} scope="col" className="px-3 py-2">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.classRows.map((row) => (
                <tr
                  key={row.classId}
                  className="border-b border-outline-variant"
                >
                  <th scope="row" className="px-3 py-3 text-left font-normal">
                    {row.classTitle}
                  </th>
                  <td className="px-3 py-3">{row.sessions}</td>
                  <td className="px-3 py-3">
                    {ieltsAvailable ? row.mocksGraded : "—"}
                  </td>
                  <td className="px-3 py-3">{row.activeLearners}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AnalyticsSection>
      <AnalyticsSection
        title={
          vi ? "Hoạt động có ghi nhận giáo viên" : "Recorded teacher activity"
        }
      >
        <p className="mb-3 type-caption text-on-surface-variant">
          {vi
            ? "Ghi nhận người điểm danh hoặc trả phản hồi. Phân công lớp hiện tại không chứng minh ai đã dạy một buổi học trước đây."
            : "Attribution uses attendance recorders or feedback authors. Current class assignments do not establish who taught a past session."}
        </p>
        <div
          className="max-w-full overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label={vi ? "Bảng giáo viên" : "Teacher table"}
        >
          <table className="w-full min-w-[560px] type-body">
            <thead>
              <tr className="border-b border-outline-variant text-left type-caption text-on-surface-variant">
                {[
                  vi ? "Giáo viên" : "Teacher",
                  vi
                    ? "Lớp được phân công hiện tại"
                    : "Currently assigned classes",
                  vi ? "Buổi học đã ghi nhận" : "Recorded sessions",
                  vi ? "Phản hồi đã trả" : "Feedback returned",
                ].map((label) => (
                  <th key={label} scope="col" className="px-3 py-2">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.teacherRows.map((row) => (
                <tr
                  key={row.teacherId}
                  className="border-b border-outline-variant"
                >
                  <th scope="row" className="px-3 py-3 text-left font-normal">
                    {data.teacherNames[row.teacherId] ||
                      (vi ? "Giáo viên chưa có tên" : "Unnamed teacher")}
                  </th>
                  <td className="px-3 py-3">
                    {row.currentClassIds
                      .map((id) => names.get(id))
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-3 py-3">{row.sessions}</td>
                  <td className="px-3 py-3">{row.publishedFeedback}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.teacherRows.length && (
          <p className="mt-3 type-body text-on-surface-variant">
            {vi
              ? "Chưa có hoạt động giáo viên được ghi nhận."
              : "No recorded teacher activity yet."}
          </p>
        )}
      </AnalyticsSection>
    </div>
  );
}
