"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/shared/product-layout";
import { Button } from "@/components/ui/button";
import {
  attentionDays,
  attentionReturnHref,
} from "@/lib/analytics/learner-followup-navigation";

export default function LearnerReportError({ reset }: { reset: () => void }) {
  const params = useParams<{
    locale: string;
    classId: string;
    studentId: string;
  }>();
  const query = useSearchParams();
  const vi = params.locale === "vi";
  return (
    <PageContainer size="focused" className="space-y-4">
      <h1 className="type-heading-md text-on-surface">
        {vi
          ? "Không thể mở báo cáo học viên"
          : "Learner report could not be opened"}
      </h1>
      <p role="alert" className="type-body text-on-surface-variant">
        {vi
          ? "Dữ liệu có thể tạm thời không khả dụng hoặc bạn không có quyền xem báo cáo này."
          : "The data may be temporarily unavailable, or you may not have access to this report."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={reset}>
          {vi ? "Thử lại" : "Try again"}
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          className="h-auto min-h-8 whitespace-normal"
          render={
            <Link
              href={`/${vi ? "vi" : "en"}${attentionReturnHref(params.classId, params.studentId, attentionDays(query.get("days") ?? undefined))}`}
            />
          }
        >
          {vi ? "Quay lại danh sách cần chú ý" : "Back to class attention"}
        </Button>
      </div>
    </PageContainer>
  );
}
