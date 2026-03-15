"use client";

import { motion } from "framer-motion";

interface PillOption {
  label: string;
  value: number;
}

interface PillSelectorProps {
  options: PillOption[];
  selected: number | null;
  onSelect: (value: number) => void;
}

export function PillSelector({ options, selected, onSelect }: PillSelectorProps) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {options.map((opt) => (
        <motion.button
          key={opt.value}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(opt.value)}
          className={`rounded-full px-6 py-3 text-sm font-semibold transition-colors ${
            selected === opt.value
              ? "bg-primary text-white shadow-md"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {opt.label}
        </motion.button>
      ))}
    </div>
  );
}
