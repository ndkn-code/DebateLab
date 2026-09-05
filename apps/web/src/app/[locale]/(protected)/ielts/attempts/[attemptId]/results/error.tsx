"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { ieltsPaths, localizedPath } from "@/lib/ielts/routes";

export default function IeltsResultsError({ reset }: { reset: () => void }) {
  const locale = useLocale();
  const vi = locale === "vi";
  return (
    <ProductPageShell>
      <PageContainer size="focused">
        <h1 className="type-heading-md text-on-surface">
          {vi ? "Chưa tải được kết quả" : "Results could not be loaded"}
        </h1>
        <p className="mt-2 type-body-sm text-on-surface-variant">
          {vi
            ? "Thử tải lại để xem kết quả bài làm của bạn."
            : "Try again to load your attempt results."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={reset}>
            {vi ? "Thử lại" : "Try again"}
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={localizedPath(locale, ieltsPaths.home)} />}
          >
            {vi ? "Về trang IELTS" : "Back to IELTS"}
          </Button>
        </div>
      </PageContainer>
    </ProductPageShell>
  );
}
