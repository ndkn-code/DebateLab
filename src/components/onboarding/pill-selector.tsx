"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PillOption {
  label: string;
  value: number;
}

interface PillSelectorProps {
  options: PillOption[];
  selected: number | null;
  onSelect: (value: number) => void;
  disabled?: boolean;
}

export function PillSelector({
  options,
  selected,
  onSelect,
  disabled = false,
}: PillSelectorProps) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {options.map((opt) => {
        const isSelected = selected === opt.value;
        const isFaded = disabled && !isSelected;
        return (
          <motion.button
            key={opt.value}
            whileHover={!disabled ? { scale: 1.05 } : undefined}
            whileTap={!disabled ? { scale: 0.95 } : undefined}
            onClick={!disabled ? () => onSelect(opt.value) : undefined}
            animate={{ opacity: isFaded ? 0.5 : 1 }}
            transition={{ duration: 0.3 }}
            className={cn(
              "rounded-full px-6 py-3 text-base md:text-lg font-medium transition-colors",
              isSelected
                ? "bg-primary text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              isFaded && "pointer-events-none"
            )}
          >
            {opt.label}
          </motion.button>
        );
      })}
    </div>
  );
}
