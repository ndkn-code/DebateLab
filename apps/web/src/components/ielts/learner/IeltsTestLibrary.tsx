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
        <PageContainer size="wide" className="py-6 lg:py-8">
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
                role="tablist"
                aria-label={t("filter_label")}
                className="mb-6 flex flex-wrap gap-2"
              >
                {filters.map((option) => {
                  const selected = option === activeFilter;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setFilter(option)}
                      className={cn(
                        "rounded-full px-4 py-2 type-body-sm font-semibold transition-colors",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                      )}
                    >
                      {filterLabel(option)}
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
