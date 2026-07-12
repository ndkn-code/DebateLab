import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ExamButtonTone = "primary" | "secondary" | "quiet";

const toneClasses: Record<ExamButtonTone, string> = {
  primary:
    "bg-primary text-on-primary shadow-[0_3px_0_color-mix(in_srgb,var(--color-primary),black_22%)]",
  secondary:
    "bg-secondary text-on-secondary shadow-[0_3px_0_color-mix(in_srgb,var(--color-secondary),black_22%)]",
  quiet:
    "bg-surface-container-high text-on-surface shadow-[0_3px_0_var(--color-outline-variant)]",
};

export function ExamButton({
  children,
  className,
  tone = "quiet",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: ExamButtonTone;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all duration-100 hover:translate-y-px active:translate-y-[3px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
