"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { PageContainer } from "@/components/shared/product-layout";
import { Button } from "@/components/ui/button";
import { ReportSelect } from "@/components/ielts/parent-report/ReportSelect";
import type {
  ParentReportRoster,
  ReportLocale,
} from "@/lib/ielts/parent-report/contract";
import { formatMonth } from "@/components/ielts/parent-report/copy";
import { reportMonthOptions } from "@/lib/ielts/parent-report/request";

export function ParentReportPicker({
  roster,
  locale,
  month,
}: {
  roster: ParentReportRoster;
  locale: ReportLocale;
  month: string;
}) {
  const vi = locale === "vi";
  const router = useRouter();
  const [studentId, setStudentId] = useState(roster.students[0]?.id ?? "");
  const [selectedMonth, setSelectedMonth] = useState(month);
  return (
    <PageContainer size="focused">
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="type-label text-on-surface-variant">
            {roster.className}
          </p>
          <h1 className="type-heading-lg text-on-surface">
            {vi ? "Báo cáo cho phụ huynh" : "Parent progress report"}
          </h1>
          <p className="type-body text-on-surface-variant">
            {vi
              ? "Kết quả luyện tập, chuyên cần và hướng luyện tập tiếp theo trong một trang."
              : "Practice results, attendance, and next steps on one page."}
          </p>
        </div>
        {roster.students.length ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <label
                  htmlFor="parent-report-student"
                  className="type-label text-on-surface"
                >
                  {vi ? "Học viên" : "Student"}
                </label>
                <ReportSelect
                  id="parent-report-student"
                  label={vi ? "Học viên" : "Student"}
                  value={studentId}
                  onChange={setStudentId}
                  options={roster.students.map((student) => ({
                    value: student.id,
                    label: student.name,
                  }))}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="parent-report-month"
                  className="type-label text-on-surface"
                >
                  {vi ? "Tháng" : "Month"}
                </label>
                <ReportSelect
                  id="parent-report-month"
                  label={vi ? "Tháng" : "Month"}
                  value={selectedMonth}
                  onChange={setSelectedMonth}
                  options={reportMonthOptions(new Date(), roster.timeZone).map((value) => ({
                    value,
                    label: formatMonth(value, locale),
                  }))}
                />
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() =>
                router.push(
                  `/dashboard/teacher/classes/${roster.classId}/reports/${studentId}?month=${selectedMonth}`,
                )
              }
            >
              {vi ? "Mở báo cáo" : "Open report"}
            </Button>
          </>
        ) : (
          <p className="type-body text-on-surface-variant">
            {vi
              ? "Lớp chưa có học viên để lập báo cáo."
              : "There are no students to report on yet."}
          </p>
        )}
      </div>
    </PageContainer>
  );
}
