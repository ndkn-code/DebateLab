"use client";

/**
 * Exam-mode textarea for the Writing tasks. Mirrors the CD-IELTS editor: no
 * spell-check, no autocorrect/autocapitalize, proportional (not monospace) type,
 * token borders and a solid focus ring. `data-exam-control` lets the exam shell
 * target it (e.g. to blur on a modal, or find the active editor for notes).
 */
import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function ExamTextarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      data-exam-control="textarea"
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
      autoComplete="off"
      className={cn(
        "min-h-[40vh] w-full resize-y rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 type-body-sm leading-relaxed text-on-surface outline-none transition-colors",
        "placeholder:text-on-surface-variant hover:border-outline focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
