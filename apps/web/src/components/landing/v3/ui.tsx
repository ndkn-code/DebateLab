"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArrowRightIcon } from "./icons";

/** Headline with one highlighted word, e.g. "Win the room." with "Win" in aqua. */
export function Highlight({
  text,
  highlight,
  className,
}: {
  text: string;
  highlight: string;
  className?: string;
}) {
  const index = text.indexOf(highlight);
  if (index === -1) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {text.slice(0, index)}
      <span className="text-primary">{highlight}</span>
      {text.slice(index + highlight.length)}
    </span>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("type-eyebrow text-primary", className)}>{children}</p>
  );
}

export function PrimaryButton({
  href,
  label,
  withArrow = false,
  className,
}: {
  href: string;
  label: string;
  withArrow?: boolean;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-medium text-on-primary transition-[background-color,transform] duration-150 hover:bg-primary-dim active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className
      )}
    >
      {label}
      {withArrow ? <ArrowRightIcon className="h-4 w-4" /> : null}
    </a>
  );
}

export function GhostButton({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-[10px] border border-outline-variant bg-white px-4 text-sm font-medium text-on-surface transition-[background-color,border-color,transform] duration-150 hover:border-primary hover:bg-surface-container-low active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className
      )}
    >
      {label}
    </a>
  );
}
