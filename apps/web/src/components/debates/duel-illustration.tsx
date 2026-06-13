"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Swappable duel illustration. Renders `/images/duel/<name>.webp` once the
 * generated artwork is dropped in; until then (or on load failure) it shows a
 * tasteful labelled placeholder so layouts are final ahead of the art.
 *
 * Asset prompts live in docs/duel-mode-revamp-plan.md §13. Drop files at
 * apps/web/public/images/duel/<name>.webp (e.g. thinkfy_duel_victory.webp).
 */
export function DuelIllustration({
  name,
  alt,
  width = 240,
  height = 180,
  className,
}: {
  name: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "flex items-center justify-center rounded-[24px] border border-dashed border-outline-variant/30 bg-surface-container-low px-4 text-center",
          className
        )}
      >
        <span className="type-eyebrow text-on-surface-variant/70">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={`/images/duel/${name}.webp`}
      alt={alt}
      width={width}
      height={height}
      onError={() => setFailed(true)}
      unoptimized
      className={cn("object-contain", className)}
    />
  );
}
