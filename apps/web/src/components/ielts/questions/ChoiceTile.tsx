"use client";

import { Check, X } from "@/components/ui/icons";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

export type ChoiceState = "idle" | "correct" | "incorrect";

interface Props {
  /** Display marker, e.g. "A" or "i"; falls back to no chip text. */
  label?: string;
  text: string;
  selected: boolean;
  /** "radio" → round marker (pick one); "checkbox" → square (pick many). */
  control: "radio" | "checkbox";
  /** Review feedback for THIS option (only the chosen option is ever judged). */
  state?: ChoiceState;
  disabled?: boolean;
  onSelect: () => void;
}

function containerClasses(selected: boolean, state: ChoiceState, dim: boolean): string {
  if (state === "correct") return "border-success bg-success-container text-on-success-container";
  if (state === "incorrect") return "border-error bg-error-container text-on-error-container";
  if (selected) return "border-primary bg-primary-container text-on-primary-container";
  return cn(
    "border-outline-variant bg-surface text-on-surface",
    !dim && "hover:border-primary hover:bg-primary-container",
  );
}

function markerClasses(selected: boolean, state: ChoiceState): string {
  if (state === "correct") return "bg-success text-on-success";
  if (state === "incorrect") return "bg-error text-on-error";
  if (selected) return "bg-primary text-on-primary";
  return "bg-surface-container text-on-surface-variant";
}

/** A single selectable option used by the choice-based renderers. */
export function ChoiceTile({
  label,
  text,
  selected,
  control,
  state = "idle",
  disabled = false,
  onSelect,
}: Props) {
  const dim = disabled && !selected && state === "idle";
  return (
    <button
      type="button"
      role={control}
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-colors",
        containerClasses(selected, state, dim),
        dim && "opacity-60",
        disabled ? "cursor-default" : "cursor-pointer",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center text-sm font-bold",
          control === "radio" ? "rounded-full" : "rounded-lg",
          markerClasses(selected, state),
        )}
      >
        {state === "correct" ? (
          <Check className="size-4" />
        ) : state === "incorrect" ? (
          <X className="size-4" />
        ) : (
          label
        )}
      </span>
      <Text variant="body" className="flex-1">
        {text}
      </Text>
    </button>
  );
}
