"use client";

import { Shimmer } from "@/components/motion";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";

export function IeltsHomeSkeleton() {
  return (
    <ProductPageShell>
      <PageContainer size="wide" className="flex flex-col gap-8 py-6 lg:py-8">
        <header className="flex flex-col gap-2">
          <Shimmer className="h-4 w-16" rounded="rounded-sm" />
          <Shimmer className="h-9 w-full max-w-72" rounded="rounded-md" />
        </header>

        <section className="rounded-lg border border-outline-variant bg-surface-container p-4 shadow-token-card sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <Shimmer className="h-4 w-24" rounded="rounded-sm" />
              <Shimmer className="h-8 w-56" rounded="rounded-md" />
            </div>
            <Shimmer className="h-5 w-24" rounded="rounded-sm" />
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Shimmer key={index} className="h-36" rounded="rounded-lg" />
            ))}
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
            <div className="space-y-2.5">
              {Array.from({ length: 3 }).map((_, index) => (
                <Shimmer key={index} className="h-20" rounded="rounded-lg" />
              ))}
            </div>
            <Shimmer className="h-56" rounded="rounded-lg" />
          </div>
        </section>

        <Shimmer className="h-80" rounded="rounded-lg" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Shimmer key={index} className="h-20" rounded="rounded-lg" />
          ))}
        </div>
      </PageContainer>
    </ProductPageShell>
  );
}
