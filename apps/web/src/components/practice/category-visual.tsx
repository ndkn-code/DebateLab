"use client";

import Image from "next/image";
import { useState } from "react";
import type { ElementType } from "react";
import {
  Brain,
  GraduationCap,
  MapPin,
  Smartphone,
  Sprout,
  Users,
} from "@/components/ui/icons";
import type { CategoryKey } from "@/lib/topics";
import { cn } from "@/lib/utils";

interface CategoryVisualMeta {
  icon: ElementType;
  tileClassName: string;
  iconClassName: string;
}

const CATEGORY_VISUALS: Record<CategoryKey, CategoryVisualMeta> = {
  education: {
    icon: GraduationCap,
    tileClassName: "bg-success-container",
    iconClassName: "text-success-dim dark:text-success",
  },
  technology: {
    icon: Smartphone,
    tileClassName: "bg-secondary-container",
    iconClassName: "text-secondary",
  },
  society: {
    icon: Users,
    tileClassName: "bg-primary-container",
    iconClassName: "text-primary-dim dark:text-primary",
  },
  environment: {
    icon: Sprout,
    tileClassName: "bg-success-container",
    iconClassName: "text-success-dim dark:text-success",
  },
  ethics: {
    icon: Brain,
    tileClassName: "bg-warning-container",
    iconClassName: "text-on-warning-container",
  },
  vietnam: {
    icon: MapPin,
    tileClassName: "bg-error-container",
    iconClassName: "text-error-dim dark:text-error",
  },
};

export function getCategoryIllustrationSrc(category: CategoryKey) {
  return `/images/practice/categories/${category}.webp`;
}

const SIZE_STYLES = {
  xs: {
    tile: "size-8 rounded-[8px]",
    icon: "h-4 w-4",
    image: 32,
  },
  sm: {
    tile: "size-10 rounded-[10px]",
    icon: "h-5 w-5",
    image: 44,
  },
  lg: {
    tile: "size-12 rounded-[10px]",
    icon: "h-7 w-7",
    image: 64,
  },
} as const;

/**
 * Category illustration tile. Renders the generated artwork from
 * /public/images/practice/categories/<key>.webp when present and falls back
 * to a tinted icon tile until those assets are dropped in.
 */
export function CategoryVisual({
  category,
  size = "sm",
  className,
}: {
  category: CategoryKey;
  size?: keyof typeof SIZE_STYLES;
  className?: string;
}) {
  const [imageMissing, setImageMissing] = useState(false);
  const meta = CATEGORY_VISUALS[category] ?? CATEGORY_VISUALS.education;
  const styles = SIZE_STYLES[size];
  const Icon = meta.icon;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden",
        styles.tile,
        meta.tileClassName,
        className,
      )}
    >
      {imageMissing ? (
        <Icon className={cn(styles.icon, meta.iconClassName)} />
      ) : (
        <Image
          src={getCategoryIllustrationSrc(category)}
          alt=""
          width={styles.image}
          height={styles.image}
          className="h-full w-full object-cover"
          unoptimized
          onError={() => setImageMissing(true)}
        />
      )}
    </span>
  );
}
