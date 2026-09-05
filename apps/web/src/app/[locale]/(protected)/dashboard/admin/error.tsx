"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { PageContainer } from "@/components/shared/product-layout";
import { AlertCircle } from "@/components/ui/icons";
import { captureHandledError } from "@/lib/observability/faro-client";

// Adapted from Lumist app/error.tsx: localized recovery copy, private diagnostics,
// and a retry action. Refresh the server payload as well as resetting the boundary.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();
  const vi = locale === "vi";
  const router = useRouter();
  useEffect(() => {
    captureHandledError(
      error,
      { digest: error.digest, featureArea: "admin_dashboard" },
      { type: "react_error_boundary" },
    );
  }, [error]);

  return (
    <PageContainer
      size="focused"
      className="grid min-h-[50vh] place-items-center"
    >
      <section role="alert" className="space-y-4 text-center">
        <AlertCircle aria-hidden="true" className="mx-auto size-8 text-error" />
        <h1 className="type-heading-md text-on-surface">
          {vi ? "Chưa thể tải trang quản trị" : "The admin page couldn’t load"}
        </h1>
        <p className="type-body text-on-surface-variant">
          {vi
            ? "Hãy thử tải lại trang. Nếu vẫn không được, bạn có thể quay về trang tổng quan."
            : "Try loading the page again. If the problem continues, you can return to the overview."}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            variant="primary"
            onClick={() => {
              router.refresh();
              reset();
            }}
          >
            {vi ? "Thử lại" : "Try again"}
          </Button>
          <Link
            href={`/${locale}/dashboard/admin`}
            className={buttonVariants({ variant: "outline" })}
          >
            {vi ? "Về tổng quan" : "Back to overview"}
          </Link>
        </div>
      </section>
    </PageContainer>
  );
}
