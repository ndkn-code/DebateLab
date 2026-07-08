"use client";

import { useCallback, useEffect } from "react";
import { Swap } from "@/components/motion";
import { Check, RotateCcw, Strikethrough, X } from "@/components/ui/icons";
import { Text } from "@/components/ui/typography";
import {
  mockAnnotationKey,
  useMockAnnotationsStore,
} from "@/lib/stores/mockAnnotationsStore";
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
  /** Enables learner-only answer elimination for objective MCQ choices. */
  allowElimination?: boolean;
  questionId?: string;
  optionId?: string;
  onSelect: () => void;
}

function containerClasses(
  selected: boolean,
  state: ChoiceState,
  dim: boolean,
  eliminated: boolean,
): string {
  if (state === "correct") return "border-success bg-success-container text-on-success-container";
  if (state === "incorrect") return "border-error bg-error-container text-on-error-container";
  if (eliminated) return "border-outline-variant bg-surface-container-low text-on-surface-variant";
  if (selected) return "border-primary bg-primary-container text-on-primary-container";
  return cn(
    "border-outline-variant bg-surface text-on-surface",
    !dim && "hover:border-primary hover:bg-primary-container",
  );
}

function markerClasses(selected: boolean, state: ChoiceState, eliminated: boolean): string {
  if (state === "correct") return "bg-success text-on-success";
  if (state === "incorrect") return "bg-error text-on-error";
  if (eliminated) return "bg-surface-container-high text-on-surface-variant";
  if (selected) return "bg-primary text-on-primary";
  return "bg-surface-container text-on-surface-variant";
}

function ChoiceMarker({ state, label }: { state: ChoiceState; label?: string }) {
  if (state === "correct") return <Check className="size-4" />;
  if (state === "incorrect") return <X className="size-4" />;
  return label;
}

function EliminationToggle({
  eliminated,
  canToggle,
  onToggle,
}: {
  eliminated: boolean;
  canToggle: boolean;
  onToggle: () => void;
}) {
  const label = eliminated ? "Undo elimination" : "Eliminate choice";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={eliminated}
      disabled={!canToggle}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        "absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border text-on-surface-variant shadow-token-card transition-all active:scale-95",
        eliminated
          ? "border-primary bg-primary text-on-primary"
          : "border-outline-variant bg-surface hover:bg-surface-container hover:text-on-surface",
        !canToggle && "cursor-not-allowed opacity-35",
      )}
      title={label}
    >
      <Swap swapKey={eliminated ? "restore" : "strike"}>
        {eliminated ? (
          <RotateCcw className="size-4" />
        ) : (
          <Strikethrough className="size-4" />
        )}
      </Swap>
    </button>
  );
}

function useChoiceElimination({
  allowElimination,
  questionId,
  optionId,
  selected,
  disabled,
  state,
}: {
  allowElimination: boolean;
  questionId?: string;
  optionId?: string;
  selected: boolean;
  disabled: boolean;
  state: ChoiceState;
}) {
  const activeAttemptId = useMockAnnotationsStore((store) => store.activeAttemptId);
  const eliminated = useMockAnnotationsStore((store) => {
    if (!allowElimination || !questionId || !optionId || !store.activeAttemptId) {
      return false;
    }
    return (
      store.eliminations[mockAnnotationKey(store.activeAttemptId, questionId)]?.has(optionId) ??
      false
    );
  });
  const toggleElimination = useMockAnnotationsStore((store) => store.toggleElimination);
  const clearElimination = useMockAnnotationsStore((store) => store.clearElimination);
  const eliminationEnabled = Boolean(
    allowElimination && activeAttemptId && questionId && optionId && state === "idle",
  );
  const canToggleElimination = eliminationEnabled && !disabled && !selected;

  const clearOwnElimination = useCallback(() => {
    if (!questionId || !optionId) return;
    clearElimination(questionId, optionId);
  }, [clearElimination, optionId, questionId]);

  const toggleOwnElimination = useCallback(() => {
    if (!canToggleElimination || !questionId || !optionId) return;
    toggleElimination(questionId, optionId);
  }, [canToggleElimination, optionId, questionId, toggleElimination]);

  useEffect(() => {
    if (!selected) return;
    clearOwnElimination();
  }, [clearOwnElimination, selected]);

  return {
    eliminated,
    eliminationEnabled,
    canToggleElimination,
    clearOwnElimination,
    toggleOwnElimination,
  };
}

/** A single selectable option used by the choice-based renderers. */
export function ChoiceTile({
  label,
  text,
  selected,
  control,
  state = "idle",
  disabled = false,
  allowElimination = false,
  questionId,
  optionId,
  onSelect,
}: Props) {
  const {
    eliminated,
    eliminationEnabled,
    canToggleElimination,
    clearOwnElimination,
    toggleOwnElimination,
  } = useChoiceElimination({
    allowElimination,
    questionId,
    optionId,
    selected,
    disabled,
    state,
  });
  const dim = (disabled && !selected && state === "idle") || eliminated;
  const selectionDisabled = disabled || eliminated;

  const handleSelect = () => {
    if (selectionDisabled) return;
    clearOwnElimination();
    onSelect();
  };

  return (
    <div className="relative w-full">
      <button
        type="button"
        role={control}
        aria-checked={selected}
        disabled={selectionDisabled}
        onClick={handleSelect}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-colors",
          eliminationEnabled && "pr-14",
          containerClasses(selected, state, dim, eliminated),
          dim && "opacity-70",
          selectionDisabled ? "cursor-default" : "cursor-pointer",
        )}
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center text-sm font-bold",
            control === "radio" ? "rounded-full" : "rounded-lg",
            markerClasses(selected, state, eliminated),
          )}
        >
          <ChoiceMarker state={state} label={label} />
        </span>
        <Text
          variant="body"
          className={cn(
            "flex-1",
            eliminated && "text-on-surface-variant line-through decoration-2",
          )}
        >
          {text}
        </Text>
      </button>
      {eliminationEnabled ? (
        <EliminationToggle
          eliminated={eliminated}
          canToggle={canToggleElimination}
          onToggle={toggleOwnElimination}
        />
      ) : null}
    </div>
  );
}
