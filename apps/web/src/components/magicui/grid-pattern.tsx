import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Adapted from Magic UI's Grid Pattern component.
 * Source: https://magicui.design/docs/components/grid-pattern
 * License: MIT, Copyright (c) Magic UI
 *
 * Reduced here to a static ruled field: no animated squares, no client JS.
 * It exists to give the hero and final CTA a measured ground plane rather than
 * a decorative blob, so it is purely presentational and always aria-hidden.
 */
export function GridPattern({
  size = 72,
  className,
  ...props
}: ComponentPropsWithoutRef<"svg"> & { size?: number }) {
  const id = `grid-${size}`;

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full stroke-outline-variant",
        className,
      )}
      {...props}
    >
      <defs>
        <pattern
          id={id}
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
        >
          <path d={`M ${size} 0 L 0 0 0 ${size}`} fill="none" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
