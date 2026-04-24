"use client";

import { cn } from "@/lib/utils";

interface CategoryTabsProps {
  categories: readonly string[];
  active: string;
  onSelect: (category: string) => void;
}

export function CategoryTabs({
  categories,
  active,
  onSelect,
}: CategoryTabsProps) {
  const tabs = ["All", ...categories];

  return (
    <div className="relative">
      <div className="scrollbar-hide flex flex-wrap gap-3 overflow-x-auto pb-1">
        {tabs.map((cat) => {
          const isActive = active === cat;

          return (
            <button
              key={cat}
              type="button"
              onClick={() => onSelect(cat)}
              className={cn(
                "inline-flex min-h-[40px] shrink-0 items-center rounded-full border px-[15px] py-2 text-[14px] font-medium transition-all",
                isActive
                  ? "border-primary bg-primary text-on-primary shadow-[0_10px_18px_-14px_rgba(77,134,247,0.95)]"
                  : "border-[#e3eaf6] bg-[#f8fbff] text-[#617292] hover:border-[#c6d7fb] hover:bg-white hover:text-on-surface"
              )}
            >
              <span className="whitespace-nowrap">{cat}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
