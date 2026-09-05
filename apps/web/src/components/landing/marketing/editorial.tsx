import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Layout vocabulary for the marketing site. The page is built from a single
 * 12-column editorial grid with hairline rules doing the separating work, so
 * sections can be asymmetric without every block turning into a card.
 */

export function Shell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1200px] px-5 sm:px-8 lg:px-10",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Eyebrow({
  children,
  className,
  tone = "muted",
}: {
  children: ReactNode;
  className?: string;
  tone?: "muted" | "accent" | "inverse";
}) {
  return (
    <p
      className={cn(
        "type-eyebrow",
        tone === "muted" && "text-on-surface-variant",
        tone === "accent" && "text-secondary",
        tone === "inverse" && "text-on-primary",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Eyebrow with the short rule that marks the start of a section. */
export function SectionMark({
  children,
  index,
  className,
}: {
  children: ReactNode;
  index?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline gap-3", className)}>
      <span
        aria-hidden="true"
        className="mt-2 h-px w-8 shrink-0 self-start bg-on-surface-variant"
      />
      <div>
        {index ? (
          <span className="type-code mr-2 text-on-surface-variant">
            {index}
          </span>
        ) : null}
        <Eyebrow className="inline">{children}</Eyebrow>
      </div>
    </div>
  );
}

/**
 * Section heading in the editorial split: mark in the narrow rail, headline and
 * lede in the wide column. Collapses to a single stacked column under lg.
 */
export function SectionHead({
  mark,
  index,
  title,
  lede,
  align = "split",
  className,
  children,
}: {
  mark: string;
  index?: string;
  title: ReactNode;
  lede?: string;
  align?: "split" | "stacked";
  className?: string;
  children?: ReactNode;
}) {
  if (align === "stacked") {
    return (
      <div className={cn("max-w-[46ch]", className)}>
        <SectionMark index={index}>{mark}</SectionMark>
        <h2 className="mt-5 type-display-sm text-on-surface">{title}</h2>
        {lede ? (
          <p className="mt-4 type-body-lg text-on-surface-variant">{lede}</p>
        ) : null}
        {children}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-x-12 gap-y-6 lg:grid-cols-12", className)}>
      <div className="lg:col-span-4">
        <SectionMark index={index}>{mark}</SectionMark>
      </div>
      <div className="lg:col-span-8">
        <h2 className="type-display-sm max-w-[22ch] text-on-surface">
          {title}
        </h2>
        {lede ? (
          <p className="mt-5 max-w-[58ch] type-body-lg text-on-surface-variant">
            {lede}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function Rule({ className }: { className?: string }) {
  return (
    <hr
      className={cn("border-0 border-t border-outline-variant", className)}
      aria-hidden="true"
    />
  );
}

/**
 * Mode / status chip. `caution` is reserved for anything provisional so the
 * IELTS honesty labels read differently from neutral metadata at a glance.
 */
export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "positive" | "caution";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 type-caption font-semibold",
        tone === "neutral" &&
          "border-outline-variant bg-surface-container-low text-on-surface-variant",
        tone === "accent" &&
          "border-transparent bg-secondary-container text-on-surface",
        tone === "positive" &&
          "border-transparent bg-success-container text-success-dim",
        tone === "caution" &&
          "border-transparent bg-warning-container text-on-surface",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Serif voice, used only for the learner's own words and the exam material. */
export function Prose({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn("type-prose", className)}>{children}</p>;
}
