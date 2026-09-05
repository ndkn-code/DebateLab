"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CalendarDays } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";

export default function TeacherWorkspaceLoading() {
  const vi = useLocale() === "vi";
  const router = useRouter();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 12_000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <ProductPageShell>
      <PageContainer size="data" className="py-4 lg:py-5">
        <div
          className={slow ? undefined : "animate-pulse"}
          role="status"
          aria-label={
            vi ? "Đang tải không gian giáo viên" : "Loading teacher workspace"
          }
        >
          <div className="flex items-center gap-3 border-b border-outline-variant pb-4">
            <span className="flex size-10 items-center justify-center rounded-control bg-surface-container-high text-on-surface-variant">
              <CalendarDays />
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-5 w-52 rounded bg-surface-container-high" />
              <div className="h-3 w-72 max-w-full rounded bg-surface-container" />
            </div>
          </div>
          <p className="mt-4 type-body-sm text-on-surface-variant">
            {slow
              ? vi
                ? "Không gian đang tải lâu hơn dự kiến. Bạn có thể thử lại mà vẫn giữ nguyên trang hiện tại."
                : "This is taking longer than expected. Retry while keeping your current page."
              : vi
                ? "Đang tải lớp và lịch của bạn…"
                : "Loading your classes and calendar…"}
          </p>
          {slow ? (
            <Button
              type="button"
              onClick={() => router.refresh()}
              variant="outline"
              size="sm"
            >
              {vi ? "Thử lại" : "Retry"}
            </Button>
          ) : null}
          <div className="mt-3 min-h-64 rounded-control border border-outline-variant bg-surface-container-low" />
        </div>
      </PageContainer>
    </ProductPageShell>
  );
}
