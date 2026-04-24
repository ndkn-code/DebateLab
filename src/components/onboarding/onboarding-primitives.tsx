"use client";

import type { ElementType, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function OnboardingShell({
  children,
  currentStep,
  totalSteps,
  backLabel,
  stepLabel,
  onBack,
  showBack = true,
  hideChrome = false,
  contentClassName,
}: {
  children: ReactNode;
  currentStep: number;
  totalSteps: number;
  backLabel: string;
  stepLabel: string;
  onBack?: () => void;
  showBack?: boolean;
  hideChrome?: boolean;
  contentClassName?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const progress = Math.max(0, Math.min(100, ((currentStep + 1) / totalSteps) * 100));

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-on-surface">
      {!hideChrome ? (
        <header className="sticky top-0 z-30 border-b border-outline-variant/30 bg-background/90 px-4 pt-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <button
              type="button"
              onClick={onBack}
              disabled={!showBack || !onBack}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-on-surface-variant transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45",
                showBack && onBack
                  ? "hover:bg-surface-container hover:text-on-surface"
                  : "pointer-events-none opacity-0"
              )}
            >
              <ChevronLeft className="h-4 w-4" />
              {backLabel}
            </button>
            <span className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface-variant shadow-[inset_0_0_0_1px_rgba(222,232,248,0.92)]">
              {stepLabel}
            </span>
          </div>
          <div className="mx-auto mt-3 h-1.5 max-w-5xl overflow-hidden rounded-full bg-outline-variant/50">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={
                prefersReducedMotion
                  ? { duration: 0.01 }
                  : { type: "spring", stiffness: 130, damping: 24 }
              }
            />
          </div>
        </header>
      ) : null}

      <main
        className={cn(
          "flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-8",
          hideChrome ? "py-8" : "py-7",
          contentClassName
        )}
      >
        {children}
      </main>
    </div>
  );
}

export function OnboardingChoiceCard({
  icon: Icon,
  emoji,
  title,
  description,
  selected,
  disabled = false,
  onClick,
}: {
  icon?: ElementType;
  emoji?: string;
  title: string;
  description?: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      whileHover={!disabled && !prefersReducedMotion ? { y: -2 } : undefined}
      whileTap={!disabled && !prefersReducedMotion ? { scale: 0.985 } : undefined}
      onClick={!disabled ? onClick : undefined}
      animate={{ opacity: disabled && !selected ? 0.56 : 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "group relative flex min-h-[5.25rem] w-full items-center gap-4 rounded-[1.25rem] border bg-surface px-4 py-4 text-left shadow-[0_18px_52px_-44px_rgba(11,20,36,0.4)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 sm:px-5",
        selected
          ? "border-primary bg-primary-container"
          : "border-outline-variant/70 hover:border-primary/45 hover:bg-surface-container-lowest",
        disabled && !selected && "pointer-events-none"
      )}
    >
      <span
        className={cn(
          "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors",
          selected
            ? "bg-primary text-on-primary"
            : "bg-surface-container text-primary group-hover:bg-primary-container"
        )}
      >
        {Icon ? <Icon className="h-5 w-5" /> : null}
        {emoji ? (
          <span className={cn(Icon && "absolute -right-1 -top-1 text-base")}>
            {emoji}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[1.02rem] font-semibold leading-6 text-on-surface sm:text-lg">
          {title}
        </span>
        {description ? (
          <span className="mt-1 block text-sm leading-5 text-on-surface-variant">
            {description}
          </span>
        ) : null}
      </span>
      {selected ? (
        <motion.span
          initial={prefersReducedMotion ? false : { scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"
        >
          <Check className="h-4 w-4" />
        </motion.span>
      ) : null}
    </motion.button>
  );
}

export function OnboardingPill({
  label,
  selected,
  disabled = false,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      whileHover={!disabled && !prefersReducedMotion ? { y: -2 } : undefined}
      whileTap={!disabled && !prefersReducedMotion ? { scale: 0.97 } : undefined}
      onClick={!disabled ? onClick : undefined}
      animate={{ opacity: disabled && !selected ? 0.55 : 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "min-h-[3rem] rounded-2xl border px-5 py-2.5 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 sm:px-6",
        selected
          ? "border-primary bg-primary text-on-primary shadow-[0_14px_28px_-20px_rgba(77,134,247,0.78)]"
          : "border-outline-variant/70 bg-surface text-on-surface-variant hover:border-primary/45 hover:bg-primary-container hover:text-on-surface",
        disabled && !selected && "pointer-events-none"
      )}
    >
      {label}
    </motion.button>
  );
}

export function OnboardingPreviewCard({
  icon: Icon,
  title,
  children,
  className,
  iconClassName,
}: {
  icon?: ElementType;
  title?: string;
  children: ReactNode;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.6rem] border border-outline-variant/55 bg-surface p-5 shadow-[0_24px_70px_-52px_rgba(11,20,36,0.42)]",
        className
      )}
    >
      {title || Icon ? (
        <div className="mb-4 flex items-center gap-3">
          {Icon ? (
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-container text-primary",
                iconClassName
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
          ) : null}
          {title ? (
            <p className="text-sm font-semibold uppercase text-on-surface-variant">
              {title}
            </p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
