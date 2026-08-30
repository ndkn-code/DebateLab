import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Adapted from Magic UI's Bento Grid component.
 * Source: https://magicui.design/docs/components/bento-grid
 * License: MIT, Copyright (c) Magic UI
 */
export function BentoGrid({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "grid auto-rows-[minmax(11rem,auto)] grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3",
        className,
      )}
      {...props}
    />
  );
}

export function BentoCard({
  className,
  ...props
}: ComponentPropsWithoutRef<"article">) {
  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-[12px] border border-outline-variant bg-surface p-5 shadow-none transition-[border-color,transform] duration-150 ease-out hover:-translate-y-0.5 hover:border-outline motion-reduce:transform-none motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}
