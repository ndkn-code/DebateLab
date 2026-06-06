"use client";

import { cn } from "@/lib/utils";
import type { CategoryFilterKey, PracticeCategoryOption } from "@/lib/topics";

interface CategoryTabsProps {
  categories: readonly PracticeCategoryOption[];
  active: CategoryFilterKey;
  onSelect: (category: CategoryFilterKey) => void;
}

export function CategoryTabs({
  categories,
  active,
  onSelect,
}: CategoryTabsProps) {
  return (
    <div className="relative">
      <div className="scrollbar-hide flex flex-wrap gap-3 overflow-x-auto pb-1">
        {categories.map((category) => {
          const isActive = active === category.key;

          return (
            <button
              key={category.key}
              type="button"
              onClick={() => onSelect(category.key)}
              className={cn(
                "inline-flex min-h-[40px] shrink-0 items-center rounded-full border px-[15px] py-2 text-[14px] font-medium transition-all",
                isActive
                  ? "border-primary bg-primary text-on-primary shadow-token-primary"
                  : "border-outline-variant bg-surface-container text-on-surface-variant hover:border-outline-variant hover:bg-white hover:text-on-surface"
                )}
              >
              <span className="whitespace-nowrap">{category.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
