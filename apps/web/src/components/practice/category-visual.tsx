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
    tileClassName: "bg-[#E5F6EC] dark:bg-[#34C759]/15",
    iconClassName: "text-[#1E9E54] dark:text-[#5DD984]",
  },
  technology: {
    icon: Smartphone,
    tileClassName: "bg-[#E3F3FF] dark:bg-[#3B9EFF]/15",
    iconClassName: "text-[#1D7FD6] dark:text-[#6FB9FF]",
  },
  society: {
    icon: Users,
    tileClassName: "bg-[#EFEAFE] dark:bg-[#8B5CF6]/15",
    iconClassName: "text-[#6D4FD0] dark:text-[#B49AFC]",
  },
  environment: {
    icon: Sprout,
    tileClassName: "bg-[#E2F7F1] dark:bg-[#14B8A6]/15",
    iconClassName: "text-[#0E9583] dark:text-[#4FD8C5]",
  },
  ethics: {
    icon: Brain,
    tileClassName: "bg-[#FFF3DC] dark:bg-[#FFD166]/15",
    iconClassName: "text-[#C98A1B] dark:text-[#FFD98A]",
  },
  vietnam: {
    icon: MapPin,
    tileClassName: "bg-[#FFEAEA] dark:bg-[#FF5A5F]/15",
    iconClassName: "text-[#D6494E] dark:text-[#FF9398]",
  },
};

export function getCategoryIllustrationSrc(category: CategoryKey) {
  return `/images/practice/categories/${category}.webp`;
}

const SIZE_STYLES = {
  sm: {
    tile: "size-11 rounded-[14px]",
    icon: "h-5 w-5",
    image: 44,
  },
  lg: {
    tile: "size-16 rounded-[20px]",
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
        className
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
