"use client";

import type { ElementType, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/shared/theme-toggle";

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
  const progress = Math.max(
    0,
    Math.min(100, ((currentStep + 1) / totalSteps) * 100),
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-on-surface">
      {!hideChrome ? (
        <header className="sticky top-0 z-30 border-b border-outline-variant bg-background px-4 pt-3 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <button
              type="button"
              onClick={onBack}
              disabled={!showBack || !onBack}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-sm font-medium text-on-surface-variant transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45",
                showBack && onBack
                  ? "hover:bg-surface-container hover:text-on-surface"
                  : "pointer-events-none opacity-0",
              )}
            >
              <ChevronLeft className="h-4 w-4" />
              {backLabel}
            </button>
            <span className="inline-flex h-5 items-center rounded-[6px] bg-surface px-2 text-xs font-medium text-on-surface-variant">
              {stepLabel}
            </span>
            <ThemeToggle variant="public" />
          </div>
          <div
            role="progressbar"
            aria-label={stepLabel}
            aria-valuemin={0}
            aria-valuemax={totalSteps}
            aria-valuenow={currentStep + 1}
            className="mx-auto mt-3 h-1.5 max-w-5xl overflow-hidden rounded-full bg-outline-variant/50"
          >
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.15, ease: "easeOut" }
              }
            />
          </div>
        </header>
      ) : null}
      {hideChrome ? (
        <ThemeToggle variant="public" className="absolute right-4 top-4 z-30" />
      ) : null}

      <main
        className={cn(
          "flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-8",
          hideChrome ? "py-8" : "py-7",
          contentClassName,
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
      aria-pressed={selected}
      disabled={disabled}
      whileHover={!disabled && !prefersReducedMotion ? { y: -2 } : undefined}
      whileTap={
        !disabled && !prefersReducedMotion ? { scale: 0.985 } : undefined
      }
      onClick={!disabled ? onClick : undefined}
      animate={{ opacity: disabled && !selected ? 0.56 : 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={cn(
        "group relative flex min-h-16 w-full items-center gap-4 rounded-control border bg-surface px-4 py-3 text-left transition-[border-color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 sm:px-5",
        selected
          ? "border-primary bg-primary-container"
          : "border-outline-variant/70 hover:border-primary/45 hover:bg-surface-container-lowest",
        disabled && !selected && "pointer-events-none",
      )}
    >
      <span
        className={cn(
          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-control transition-colors",
          selected
            ? "bg-primary text-on-primary"
            : "bg-surface-container text-primary group-hover:bg-primary-container",
        )}
      >
        {Icon ? <Icon className="h-5 w-5" /> : null}
        {emoji ? (
          <span
            aria-hidden="true"
            className={cn(Icon && "absolute -right-1 -top-1 text-base")}
          >
            {emoji}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block type-body font-semibold leading-6 text-on-surface sm:text-lg">
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
      aria-pressed={selected}
      disabled={disabled}
      whileHover={!disabled && !prefersReducedMotion ? { y: -2 } : undefined}
      whileTap={
        !disabled && !prefersReducedMotion ? { scale: 0.97 } : undefined
      }
      onClick={!disabled ? onClick : undefined}
      animate={{ opacity: disabled && !selected ? 0.55 : 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={cn(
        "h-8 rounded-control border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 sm:px-5",
        selected
          ? "border-primary bg-primary text-on-primary shadow-token-primary"
          : "border-outline-variant/70 bg-surface text-on-surface-variant hover:border-primary/45 hover:bg-primary-container hover:text-on-surface",
        disabled && !selected && "pointer-events-none",
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
        "rounded-control border border-outline-variant bg-surface p-4 shadow-none",
        className,
      )}
    >
      {title || Icon ? (
        <div className="mb-4 flex items-center gap-3">
          {Icon ? (
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-[8px] bg-primary-container text-primary",
                iconClassName,
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
