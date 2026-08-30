"use client";

import { useLocale } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { ProductIcon } from "@/components/ui/product-icon";
import { Link } from "@/i18n/navigation";

export function IeltsRouteError({
  reset,
  supportCode,
}: {
  reset: () => void;
  supportCode: string;
}) {
  const vi = useLocale() === "vi";
  return (
    <main className="mx-auto grid min-h-full w-full max-w-3xl place-items-center p-4 sm:p-6">
      <section className="w-full rounded-xl border border-error/25 bg-surface p-5 shadow-token-card sm:p-6">
        <span className="flex size-10 items-center justify-center rounded-xl bg-error-container text-error">
          <ProductIcon name="warning" size="md" />
        </span>
        <h1 className="mt-4 type-heading-lg text-on-surface">
          {vi ? "Chưa thể tải trang này" : "This page could not load"}
        </h1>
        <p className="mt-2 type-body-sm text-on-surface-variant">
          {vi
            ? "Hãy thử lại. Nếu lỗi tiếp diễn, gửi mã hỗ trợ bên dưới cho chúng tôi."
            : "Try again. If the problem continues, share the support code below with us."}
        </p>
        <p className="mt-2 type-caption text-on-surface-variant">
          {vi ? "Mã hỗ trợ" : "Support code"}: {supportCode}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={reset}>
            <ProductIcon name="refresh" size="sm" />
            {vi ? "Thử lại" : "Try again"}
          </Button>
          <Link
            href="/ielts/home"
            className={buttonVariants({ variant: "secondary" })}
          >
            {vi ? "Về trang IELTS" : "Back to IELTS home"}
          </Link>
        </div>
      </section>
    </main>
  );
}
