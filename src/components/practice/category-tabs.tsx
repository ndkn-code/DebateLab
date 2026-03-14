"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  Smartphone,
  Users,
  Leaf,
  Scale,
  MapPin,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/topics";

const categoryIcons: Record<string, React.ElementType> = {
  All: LayoutGrid,
  "Education & School Life": BookOpen,
  "Technology & Social Media": Smartphone,
  "Society & Culture": Users,
  "Environment & Sustainability": Leaf,
  "Ethics & Philosophy": Scale,
  "Vietnam-Specific Issues": MapPin,
};

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
  const tabs = ["All", ...categories] as const;

  return (
    <div className="relative -mx-4 px-4">
      <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
        {tabs.map((cat) => {
          const Icon = categoryIcons[cat] ?? LayoutGrid;
          const isActive = active === cat;

          return (
            <button
              key={cat}
              onClick={() => onSelect(cat)}
              className={cn(
                "relative flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "text-on-surface"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/30"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
              <Icon className="relative z-10 h-4 w-4" />
              <span className="relative z-10 whitespace-nowrap">{cat}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
