import type { ReactNode } from "react";
import { ArrowRight, Sparkles } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface BeautifulRecommendationAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Adapted from Beautiful UI's confidence-backed Recommendation Card.
 * Original source Copyright (c) 2026 Shane Levine, MIT License.
 */
export function BeautifulRecommendationCard({
  eyebrow,
  title,
  description,
  confidenceLabel,
  confidenceValue,
  primaryAction,
  secondaryAction,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  confidenceLabel?: string;
  confidenceValue?: number;
  primaryAction?: BeautifulRecommendationAction;
  secondaryAction?: BeautifulRecommendationAction;
  children?: ReactNode;
  className?: string;
}) {
  const normalizedConfidence =
    confidenceValue === undefined
      ? undefined
      : Math.min(100, Math.max(0, confidenceValue));

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border border-outline-variant bg-surface",
        className,
      )}
    >
      <div className="px-4 py-4">
        {eyebrow ? (
          <div className="mb-2 flex items-center gap-1.5 type-caption font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="size-3.5" aria-hidden="true" />
            {eyebrow}
          </div>
        ) : null}
        <h3 className="type-title font-semibold text-on-surface">{title}</h3>
        {description ? (
          <div className="mt-1.5 type-body-sm text-on-surface-variant">
            {description}
          </div>
        ) : null}
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
      {confidenceLabel || primaryAction || secondaryAction ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant bg-surface-container-low/45 px-4 py-3">
          {confidenceLabel ? (
            <div className="min-w-[120px] flex-1">
              <div className="flex items-center justify-between gap-2 type-caption font-medium text-on-surface-variant">
                <span>{confidenceLabel}</span>
                {normalizedConfidence !== undefined ? (
                  <span>{normalizedConfidence}%</span>
                ) : null}
              </div>
              {normalizedConfidence !== undefined ? (
                <div
                  role="progressbar"
                  aria-label={confidenceLabel}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={normalizedConfidence}
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-container-high"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${normalizedConfidence}%` }}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {secondaryAction ? (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.disabled}
                className="h-8 rounded-[10px] border border-outline-variant bg-surface px-3 type-label font-medium text-on-surface transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {secondaryAction.label}
              </button>
            ) : null}
            {primaryAction ? (
              <button
                type="button"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-primary px-3 type-label font-medium text-on-primary transition-[background-color,transform] hover:bg-primary-dim active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                {primaryAction.label}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
