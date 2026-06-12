"use client";

import Image from "next/image";
import { useState } from "react";
import { Lock, Star } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { ProfileAchievementItem } from "@/lib/profile-social/tab-model";

const SIZE_STYLES = {
  sm: { box: "size-12", image: 48, emoji: "text-lg", lock: "size-5", lockIcon: "size-3" },
  md: { box: "size-16", image: 64, emoji: "text-2xl", lock: "size-7", lockIcon: "size-3.5" },
  lg: { box: "size-24", image: 96, emoji: "text-3xl", lock: "size-9", lockIcon: "size-4.5" },
} as const;

export function getAchievementArtSrc(slug: string | null | undefined) {
  const normalized = slug
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "");

  return normalized ? `/images/achievements/${normalized}.webp` : null;
}

/**
 * Achievement badge. Renders the generated shield artwork from
 * /public/images/achievements/<slug>.webp when present (locked state is
 * desaturated with a lock chip, mirroring the leaderboard LeagueCrest), and
 * falls back to the legacy emoji medallion until those assets exist.
 */
export function AchievementMedallion({
  achievement,
  size = "md",
  showFeaturedStar = true,
  className,
}: {
  achievement: ProfileAchievementItem;
  size?: keyof typeof SIZE_STYLES;
  showFeaturedStar?: boolean;
  className?: string;
}) {
  const [imageMissing, setImageMissing] = useState(false);
  const styles = SIZE_STYLES[size];
  const unlocked = achievement.unlocked;
  const artSrc = getAchievementArtSrc(achievement.slug);
  const hasArt = Boolean(artSrc) && !imageMissing;

  return (
    <span className={cn("relative inline-flex shrink-0", styles.box, className)}>
      {hasArt ? (
        <Image
          src={artSrc as string}
          alt=""
          width={styles.image}
          height={styles.image}
          unoptimized
          draggable={false}
          onError={() => setImageMissing(true)}
          className={cn(
            "size-full object-contain drop-shadow-token-card",
            !unlocked && "opacity-45 saturate-0"
          )}
        />
      ) : (
        <span
          className={cn(
            "flex size-full items-center justify-center rounded-full border-2 font-semibold shadow-token-card",
            styles.emoji,
            unlocked
              ? "border-primary-fixed bg-surface-container text-primary-dim"
              : "border-outline-variant bg-surface-container text-muted-foreground saturate-0"
          )}
        >
          {unlocked ? achievement.icon : <Lock className={styles.lockIcon} />}
        </span>
      )}

      {hasArt && !unlocked ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "flex items-center justify-center rounded-full bg-white/85 text-on-surface-variant shadow-token-card backdrop-blur-sm dark:bg-surface-container-high/85",
              styles.lock
            )}
          >
            <Lock className={styles.lockIcon} />
          </span>
        </span>
      ) : null}

      {showFeaturedStar && achievement.isFeatured ? (
        <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-reward text-on-reward shadow-token-card">
          <Star className="size-3 fill-current" />
        </span>
      ) : null}
    </span>
  );
}
