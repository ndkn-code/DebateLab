"use client";

import { OnboardingPill } from "./onboarding-primitives";

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
        return (
          <OnboardingPill
            key={opt.value}
            label={opt.label}
            selected={isSelected}
            disabled={disabled}
            onClick={() => onSelect(opt.value)}
          />
        );
      })}
    </div>
  );
}
