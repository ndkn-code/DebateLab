"use client";

import type { ElementType } from "react";
import { OnboardingChoiceCard } from "./onboarding-primitives";

interface SelectionCardProps {
  emoji?: string;
  icon?: ElementType;
  title: string;
  description?: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function SelectionCard({
  emoji,
  icon,
  title,
  description,
  selected,
  disabled = false,
  onClick,
}: SelectionCardProps) {
  return (
    <OnboardingChoiceCard
      emoji={emoji}
      icon={icon}
      title={title}
      description={description}
      selected={selected}
      disabled={disabled}
      onClick={onClick}
    />
  );
}
