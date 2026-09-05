"use client";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/product-layout";

// Partial adaptation of Lumist app/error.tsx: semantic main/section, localized
// heading/explanation and visible manual retry. Thinkfy owns styling and auth.
export function AccessRecovery({ locale, next }: { locale: string; next: string }) {
  const vi = locale === "vi";
  return (
    <main className="flex min-h-dvh items-center bg-background text-on-surface" data-surface="workbench">
      <PageContainer size="focused">
        <section aria-labelledby="recovery-title" className="space-y-4">
          <h1 id="recovery-title" className="type-heading-lg">
            {vi ? "Tạm thời chưa thể mở trang" : "This page is temporarily unavailable"}
          </h1>
          <p className="type-body-sm text-on-surface-variant">
            {vi
              ? "Chúng tôi chưa thể xác minh quyền truy cập của bạn. Hãy thử lại sau ít phút."
              : "We couldn’t verify your access. Please try again in a few moments."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="lg" onClick={() => window.location.assign(next)}>
              {vi ? "Thử lại trang này" : "Retry this page"}
            </Button>
            <Button nativeButton={false} variant="outline" size="lg" render={<a href={`/${vi ? "vi" : "en"}`} />}>
              {vi ? "Về trang chủ" : "Return home"}
            </Button>
          </div>
        </section>
      </PageContainer>
    </main>
  );
}
