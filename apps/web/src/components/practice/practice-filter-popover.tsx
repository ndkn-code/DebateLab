"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw, SlidersHorizontal } from "@/components/ui/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Eyebrow } from "@/components/ui/typography";
import type { CategoryFilterKey, PracticeCategoryOption } from "@/lib/topics";
import { cn } from "@/lib/utils";

export type PracticeSortOption = "popular" | "newest" | "easiest" | "hardest";
export type PracticeDifficultyFilter = "all" | "easy" | "medium" | "hard";

interface PracticeFilterPopoverProps {
  categories: readonly PracticeCategoryOption[];
  activeCategory: CategoryFilterKey;
  onCategoryChange: (category: CategoryFilterKey) => void;
  difficulty: PracticeDifficultyFilter;
  onDifficultyChange: (difficulty: PracticeDifficultyFilter) => void;
  sort: PracticeSortOption;
  onSortChange: (sort: PracticeSortOption) => void;
  activeFilterCount: number;
  onReset: () => void;
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Eyebrow className="text-on-surface-variant">{label}</Eyebrow>
      <div className="mt-2.5 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-2 type-label font-medium transition-all active:scale-95",
        active
          ? "border-primary bg-primary text-on-primary"
          : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-primary/35 hover:text-on-surface"
      )}
    >
      {children}
    </button>
  );
}

export function PracticeFilterPopover({
  categories,
  activeCategory,
  onCategoryChange,
  difficulty,
  onDifficultyChange,
  sort,
  onSortChange,
  activeFilterCount,
  onReset,
}: PracticeFilterPopoverProps) {
  const t = useTranslations("dashboard.practice");

  const difficultyOptions: Array<{
    value: PracticeDifficultyFilter;
    label: string;
  }> = [
    { value: "all", label: t("difficulty_all") },
    { value: "easy", label: t("card_easy") },
    { value: "medium", label: t("card_medium") },
    { value: "hard", label: t("card_hard") },
  ];

  const sortOptions: Array<{ value: PracticeSortOption; label: string }> = [
    { value: "popular", label: t("sort_popular") },
    { value: "newest", label: t("sort_newest_practice") },
    { value: "easiest", label: t("sort_easiest") },
    { value: "hardest", label: t("sort_hardest") },
  ];

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={t("filters")}
            className={cn(
              "relative inline-flex h-12 shrink-0 items-center gap-2.5 rounded-2xl border bg-surface-container-lowest px-4 type-body-sm font-semibold transition-all hover:bg-surface-container active:scale-[0.97]",
              activeFilterCount > 0
                ? "border-primary/40 text-primary"
                : "border-outline-variant text-on-surface-variant"
            )}
          />
        }
      >
        <SlidersHorizontal className="h-[17px] w-[17px]" />
        <span className="max-sm:hidden">{t("filters")}</span>
        {activeFilterCount > 0 ? (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary type-caption font-bold leading-none text-on-primary">
            {activeFilterCount}
          </span>
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        showArrow={false}
        className="w-[min(calc(100vw-2rem),26rem)] rounded-[1.5rem] p-6"
      >
        <div className="space-y-6">
          <FilterGroup label={t("filter_category")}>
            {categories.map((category) => (
              <FilterChip
                key={category.key}
                active={activeCategory === category.key}
                onClick={() => onCategoryChange(category.key)}
              >
                {category.label}
              </FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup label={t("filter_difficulty")}>
            {difficultyOptions.map((option) => (
              <FilterChip
                key={option.value}
                active={difficulty === option.value}
                onClick={() => onDifficultyChange(option.value)}
              >
                {option.label}
              </FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup label={t("filter_sort")}>
            {sortOptions.map((option) => (
              <FilterChip
                key={option.value}
                active={sort === option.value}
                onClick={() => onSortChange(option.value)}
              >
                {option.label}
              </FilterChip>
            ))}
          </FilterGroup>

          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-2 type-label text-primary transition-opacity hover:opacity-75"
            >
              <RotateCcw className="h-[14px] w-[14px]" />
              {t("filter_clear")}
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
