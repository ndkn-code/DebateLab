"use client";

import { getStringValue, setValue } from "@/lib/ielts/question-types";
import type { IeltsAnswer, IeltsOption } from "@/lib/ielts/question-types";
import { cn } from "@/lib/utils";
import type { ChoiceState } from "./ChoiceTile";

interface Props {
  blankId: string;
  value: IeltsAnswer | null;
  onChange: (next: IeltsAnswer) => void;
  /** When provided, renders a bank dropdown (select mode) instead of a text input. */
  options?: IeltsOption[];
  disabled?: boolean;
  state?: ChoiceState;
  ariaLabel: string;
  placeholder?: string;
  /** "inline" sits within a sentence; "block" fills its container. */
  layout?: "inline" | "block";
}

function stateBorder(state: ChoiceState): string {
  if (state === "correct") return "border-success bg-success-container";
  if (state === "incorrect") return "border-error bg-error-container";
  return "border-outline-variant bg-surface focus:border-primary";
}

/** A single fill-in slot: a text input, or a bank dropdown when `options` are given. */
export function BlankControl({
  blankId,
  value,
  onChange,
  options,
  disabled = false,
  state = "idle",
  ariaLabel,
  placeholder,
  layout = "inline",
}: Props) {
  const current = getStringValue(value, blankId);
  const width = layout === "inline" ? "w-36" : "w-full";
  const base = cn(
    "h-10 rounded-xl border-2 px-3 text-sm text-on-surface transition-colors",
    "focus:outline-none disabled:cursor-default",
    width,
    stateBorder(state),
  );

  if (options && options.length > 0) {
    return (
      <select
        aria-label={ariaLabel}
        disabled={disabled}
        value={current}
        onChange={(event) => onChange(setValue(value, blankId, event.target.value))}
        className={base}
      >
        <option value="">{placeholder ?? "—"}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label ? `${option.label}. ${option.text}` : option.text}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type="text"
      aria-label={ariaLabel}
      disabled={disabled}
      value={current}
      placeholder={placeholder}
      autoComplete="off"
      onChange={(event) => onChange(setValue(value, blankId, event.target.value))}
      className={base}
    />
  );
}
