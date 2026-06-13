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
        "btn-3d-primary inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-8 text-base font-bold text-on-primary hover:bg-primary-dim",
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
        "inline-flex h-14 items-center justify-center rounded-2xl border border-outline-variant bg-white px-8 text-base font-bold text-primary-dim shadow-token-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-token-primary",
        className
      )}
    >
      {label}
    </a>
  );
}
