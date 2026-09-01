"use client";

import { useLocale } from "next-intl";
import { CalendarDays } from "@/components/ui/icons";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";

export default function TeacherWorkspaceLoading() {
  const vi = useLocale() === "vi";
  return (
    <ProductPageShell>
      <PageContainer size="data" className="py-4 lg:py-5">
        <div
          className="animate-pulse"
          role="status"
          aria-label={
            vi ? "Đang tải không gian giáo viên" : "Loading teacher workspace"
          }
        >
          <div className="flex items-center gap-3 border-b border-outline-variant pb-4">
            <span className="flex size-10 items-center justify-center rounded-control bg-surface-container-high text-on-surface-variant">
              <CalendarDays />
            </span>
            <div className="space-y-2">
              <div className="h-5 w-52 rounded bg-surface-container-high" />
              <div className="h-3 w-72 max-w-full rounded bg-surface-container" />
            </div>
          </div>
          <div className="mt-4 h-8 w-full max-w-3xl rounded bg-surface-container" />
          <div className="mt-3 h-[32rem] rounded-[12px] border border-outline-variant bg-surface-container-low" />
        </div>
      </PageContainer>
    </ProductPageShell>
  );
}
