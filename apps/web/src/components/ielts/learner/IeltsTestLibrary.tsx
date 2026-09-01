"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { GraduationCap } from "@/components/ui/icons";
import { PageTransition } from "@/components/shared/page-motion";
import {
  PageContainer,
  ProductPageHeader,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { cn } from "@/lib/utils";
import {
  availableLibraryFilters,
  filterTestCards,
  type IeltsLibraryFilter,
  type IeltsTestCard,
} from "@/lib/ielts/learner/library";
import { TestCard } from "./TestCard";
import { IeltsEmptyState } from "./EmptyState";

function useFilterLabel() {
  const t = useTranslations("dashboard.ielts");
  return (filter: IeltsLibraryFilter): string => {
    if (filter === "all") return t("filter_all");
    if (filter === "full_mock") return t("filter_full_mock");
    return t(`skill_${filter}`);
  };
}

/**
 * IELTS test library (WS-5.1). Lists every published test as a job-board grid
 * with a lightweight skill/kind filter, mirroring the debate practice library.
 * Each card links into the existing mock player to start a sitting.
 */
export function IeltsTestLibrary({ tests }: { tests: IeltsTestCard[] }) {
  const t = useTranslations("dashboard.ielts");
  const filterLabel = useFilterLabel();
  const [filter, setFilter] = useState<IeltsLibraryFilter>("all");

  const filters = availableLibraryFilters(tests);
  const activeFilter = filters.includes(filter) ? filter : "all";
  const visible = filterTestCards(tests, activeFilter);

  return (
    <PageTransition>
      <ProductPageShell>
        <PageContainer size="data" className="py-5 lg:py-6">
          <ProductPageHeader
            title={t("library_title")}
            icon={<GraduationCap />}
          />

          {tests.length === 0 ? (
            <IeltsEmptyState
              icon={<GraduationCap className="size-6" />}
              title={t("empty_tests_title")}
              body={t("empty_tests_body")}
            />
          ) : (
            <>
              <div
                role="group"
                aria-label={t("filter_label")}
                className="mb-4 flex flex-wrap gap-2"
              >
                {filters.map((option) => {
                  const selected = option === activeFilter;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setFilter(option)}
                      className={cn(
                        "inline-flex min-h-8 items-center rounded-control border px-3 type-label font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected
                          ? "border-on-surface bg-on-surface text-surface"
                          : "border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                      )}
                    >
                      {filterLabel(option)}
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((card) => (
                  <TestCard key={card.id} card={card} />
                ))}
              </div>
            </>
          )}
        </PageContainer>
      </ProductPageShell>
    </PageTransition>
  );
}
