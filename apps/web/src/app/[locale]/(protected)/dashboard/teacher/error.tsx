"use client";

import { AlertCircle } from "@/components/ui/icons";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";

export default function TeacherWorkspaceError({
  reset,
}: {
  reset: () => void;
}) {
  const vi = useLocale() === "vi";
  return (
    <ProductPageShell>
      <PageContainer
        size="focused"
        className="grid min-h-[60vh] place-items-center text-center"
      >
        <div>
          <AlertCircle className="mx-auto size-10 text-error" />
          <h1 className="mt-4 type-heading-md font-semibold text-on-surface">
            {vi
              ? "Không thể tải không gian giáo viên"
              : "Teacher workspace couldn’t load"}
          </h1>
          <p className="mt-2 type-body-sm text-on-surface-variant">
            {vi
              ? "Quyền truy cập lớp của bạn không thay đổi. Hãy thử tải lại không gian."
              : "Your class access is unchanged. Try loading the workspace again."}
          </p>
          <Button className="mt-4" onClick={reset}>
            {vi ? "Thử lại" : "Try again"}
          </Button>
        </div>
      </PageContainer>
    </ProductPageShell>
  );
}
