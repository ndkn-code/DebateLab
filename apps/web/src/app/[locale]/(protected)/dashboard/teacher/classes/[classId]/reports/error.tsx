"use client";

import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/product-layout";

export default function ParentReportError({ reset }: { reset: () => void }) {
  const vi = useLocale() !== "en";
  return <PageContainer size="focused"><div role="alert" className="space-y-4">
    <h1 className="type-heading-lg text-on-surface">{vi ? "Chưa thể mở báo cáo" : "The report could not be opened"}</h1>
    <p className="type-body text-on-surface-variant">{vi ? "Kiểm tra quyền truy cập lớp và thử lại. Dữ liệu chưa tải xong sẽ không được in hoặc xuất." : "Check your class access and try again. Incomplete data cannot be printed or exported."}</p>
    <Button variant="primary" onClick={reset}>{vi ? "Thử lại" : "Try again"}</Button>
  </div></PageContainer>;
}
