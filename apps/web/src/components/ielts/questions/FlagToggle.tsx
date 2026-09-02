"use client";

/**
 * "Flag for review" toggle for one mock question — the same store-backed
 * control `QuestionHost` draws, extracted so grouped blanks (summary gaps,
 * table cells, diagram pins) can carry a flag next to their number badge.
 */
import { Bookmark, BookmarkCheck } from "@/components/ui/icons";
import {
  mockAnnotationKey,
  useMockAnnotationsStore,
} from "@/lib/stores/mockAnnotationsStore";
import { cn } from "@/lib/utils";

export function FlagToggle({
  questionId,
  size = "md",
  className,
}: {
  questionId: string;
  /** `sm` sits inline with a blank; `md` matches the QuestionHost number badge. */
  size?: "sm" | "md";
  className?: string;
}) {
  const isFlagged = useMockAnnotationsStore((store) => {
    if (!store.activeAttemptId) return false;
    return (
      store.flags[mockAnnotationKey(store.activeAttemptId, questionId)] === true
    );
  });
  const toggleFlag = useMockAnnotationsStore((store) => store.toggleFlag);
  const FlagIcon = isFlagged ? BookmarkCheck : Bookmark;
  const label = isFlagged ? "Remove flag" : "Flag for review";

  return (
    <button
      type="button"
      data-exam-control
      onClick={() => toggleFlag(questionId)}
      aria-pressed={isFlagged}
      title={label}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border transition active:scale-95",
        size === "sm" ? "size-6" : "size-7",
        isFlagged
          ? "border-warning bg-warning-container text-on-warning-container"
          : "border-outline-variant bg-surface text-on-surface-variant hover:border-warning hover:text-warning",
        className,
      )}
    >
      <FlagIcon
        className={size === "sm" ? "size-3" : "size-3.5"}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </button>
  );
}
