"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

import { setProfileFeaturedAchievements } from "@/app/actions/profile-social";
import {
  Award,
  CheckCircle2,
  ChevronDown,
  Lock,
  ShieldCheck,
  Star,
  X,
} from "@/components/ui/icons";
import { AchievementMedallion } from "@/components/profile/achievement-medallion";
import { Eyebrow, Heading } from "@/components/ui/typography";
import { showToast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";
import {
  getAchievementProgressPercent,
  normalizeFeaturedAchievementIds,
  type ProfileAchievementItem,
  type ProfileAchievementsData,
} from "@/lib/profile-social/tab-model";

type AchievementSort = "featured" | "recent" | "progress" | "category";

function titleCase(value: string) {
  return value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

const ACHIEVEMENT_CATEGORY_KEYS: Record<string, true> = {
  debate: true,
  duel: true,
  mastery: true,
  practice: true,
  general: true,
};

function getCategoryLabel(
  category: string,
  t: ReturnType<typeof useTranslations<"profileSocial.achievements">>
) {
  return ACHIEVEMENT_CATEGORY_KEYS[category]
    ? t(`categories.${category}`)
    : titleCase(category);
}

function sortAchievements(
  achievements: ProfileAchievementItem[],
  sort: AchievementSort
) {
  return [...achievements].sort((left, right) => {
    if (sort === "category") {
      return (
        left.category.localeCompare(right.category) ||
        left.sortOrder - right.sortOrder
      );
    }

    if (sort === "progress") {
      return (
        getAchievementProgressPercent(right) - getAchievementProgressPercent(left) ||
        left.sortOrder - right.sortOrder
      );
    }

    if (sort === "recent") {
      if (left.unlocked && right.unlocked) {
        return (
          new Date(right.unlockedAt ?? 0).getTime() -
          new Date(left.unlockedAt ?? 0).getTime()
        );
      }
      if (left.unlocked) return -1;
      if (right.unlocked) return 1;
      return left.sortOrder - right.sortOrder;
    }

    if (left.isFeatured !== right.isFeatured) return left.isFeatured ? -1 : 1;
    if (left.unlocked !== right.unlocked) return left.unlocked ? -1 : 1;
    return left.sortOrder - right.sortOrder;
  });
}

function AchievementInfoDialog({
  achievement,
  onClose,
}: {
  achievement: ProfileAchievementItem;
  onClose: () => void;
}) {
  const t = useTranslations("profileSocial.achievements");
  const percent = getAchievementProgressPercent(achievement);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-container-high/55 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievement-dialog-title"
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md rounded-[24px] border border-outline-variant bg-surface-container-lowest p-7 shadow-token-card"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full bg-surface-container text-on-surface transition hover:bg-surface-container-high active:scale-90"
        >
          <X className="size-4.5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <AchievementMedallion achievement={achievement} size="lg" className="!size-28" />
          <Eyebrow className="mt-4 text-on-surface-variant">
            {getCategoryLabel(achievement.category, t)}
          </Eyebrow>
          <Heading
            level={3}
            as="h2"
            id="achievement-dialog-title"
            className="mt-1.5 font-extrabold"
          >
            {achievement.title}
          </Heading>
          <p className="mt-2 max-w-sm text-sm leading-6 text-on-surface-variant">
            {achievement.description}
          </p>
        </div>

        <div className="mt-6 rounded-2xl bg-surface-container p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-on-surface">{t("progress")}</span>
            <span className="font-semibold tabular-nums text-on-surface-variant">
              {achievement.progressValue != null && achievement.progressTarget != null
                ? `${achievement.progressValue} / ${achievement.progressTarget}`
                : achievement.unlocked
                  ? t("complete")
                  : t("incomplete")}
            </span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-2xl bg-warning-container p-3.5">
            <Eyebrow className="text-on-warning-container">
              {t("xp_reward")}
            </Eyebrow>
            <p className="mt-1 type-body font-extrabold tabular-nums text-on-surface">
              {achievement.xpReward} XP
            </p>
          </div>
          <div className="rounded-2xl bg-primary-container p-3.5">
            <Eyebrow className="text-primary-dim">
              {t("title_reward")}
            </Eyebrow>
            <p className="mt-1 truncate type-body font-extrabold text-on-surface">
              {achievement.titleReward ?? t("none")}
            </p>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

function EmptyState({ privateState }: { privateState?: boolean }) {
  const t = useTranslations("profileSocial.achievements");

  return (
    <section className="rounded-[24px] border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-16 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        {privateState ? (
          <ShieldCheck className="size-6" />
        ) : (
          <Award className="size-6" />
        )}
      </div>
      <h2 className="mt-5 text-lg font-bold text-on-surface">
        {privateState ? t("private_title") : t("empty_title")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-on-surface-variant">
        {privateState ? t("private_body") : t("empty_body")}
      </p>
    </section>
  );
}

function AchievementCard({
  achievement,
  index,
  canFeature,
  featuredIds,
  maxFeatured,
  onToggleFeatured,
  onSelect,
  pending,
}: {
  achievement: ProfileAchievementItem;
  index: number;
  canFeature: boolean;
  featuredIds: string[];
  maxFeatured: number;
  onToggleFeatured: (achievement: ProfileAchievementItem) => void;
  onSelect: (achievement: ProfileAchievementItem) => void;
  pending: boolean;
}) {
  const t = useTranslations("profileSocial.achievements");
  const prefersReducedMotion = useReducedMotion();
  const percent = getAchievementProgressPercent(achievement);
  const featured = featuredIds.includes(achievement.id);
  const featureDisabled =
    pending ||
    !achievement.unlocked ||
    (!featured && featuredIds.length >= maxFeatured);

  return (
    <motion.article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(achievement)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(achievement);
        }
      }}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.26,
        delay: Math.min(index * 0.03, 0.3),
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn(
        "relative flex cursor-pointer flex-col items-center rounded-[24px] border bg-surface-container-lowest p-6 pt-7 text-center shadow-token-card transition-transform duration-200 hover:-translate-y-1",
        featured ? "border-primary/40" : "border-outline-variant"
      )}
    >
      {canFeature ? (
        <button
          type="button"
          disabled={featureDisabled}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFeatured(achievement);
          }}
          aria-label={
            featured
              ? t("unfeature_label", { title: achievement.title })
              : t("feature_label", { title: achievement.title })
          }
          className={cn(
            "absolute right-4 top-4 flex size-9 items-center justify-center rounded-full transition-all active:scale-90",
            featured
              ? "bg-reward text-on-reward shadow-token-card"
              : "bg-surface-container text-on-surface-variant hover:text-on-surface",
            featureDisabled && "cursor-not-allowed opacity-40"
          )}
        >
          <Star className={cn("size-4.5", featured && "fill-current")} />
        </button>
      ) : featured ? (
        <span className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-reward text-on-reward shadow-token-card">
          <Star className="size-4.5 fill-current" />
        </span>
      ) : null}

      <AchievementMedallion
        achievement={achievement}
        size="lg"
        showFeaturedStar={false}
      />

      <h3 className="mt-4 line-clamp-2 type-title font-extrabold leading-6 text-on-surface">
        {achievement.title}
      </h3>
      <p className="mt-1 type-caption font-semibold text-on-surface-variant">
        {getCategoryLabel(achievement.category, t)}
      </p>

      <div className="mt-auto w-full pt-5">
        {achievement.unlocked ? (
          <p className="inline-flex items-center gap-1.5 type-caption font-bold text-success-dim">
            <CheckCircle2 className="size-4" />
            {t("complete")}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between type-caption font-bold tabular-nums text-on-surface-variant">
              <span className="inline-flex items-center gap-1">
                <Lock className="size-3.5" />
                {achievement.progressValue != null &&
                achievement.progressTarget != null
                  ? `${achievement.progressValue} / ${achievement.progressTarget}`
                  : t("incomplete")}
              </span>
              <span>{percent}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="h-full rounded-full bg-primary-fixed"
                style={{ width: `${percent}%` }}
              />
            </div>
          </>
        )}
      </div>
    </motion.article>
  );
}

export function ProfileAchievementsTab({
  data,
}: {
  data: ProfileAchievementsData | null | undefined;
}) {
  const t = useTranslations("profileSocial.achievements");
  const prefersReducedMotion = useReducedMotion();
  const [currentData, setCurrentData] = useState<ProfileAchievementsData | null>(
    data ?? null
  );
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<AchievementSort>("featured");
  const [selected, setSelected] = useState<ProfileAchievementItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const effectiveData = currentData ?? data;
  const privateState =
    !effectiveData ||
    effectiveData.state === "private" ||
    effectiveData.state === "blocked" ||
    effectiveData.state === "not_found";
  const canFeature = effectiveData?.viewerMode === "self";
  const categories = ["all", ...(effectiveData?.categories ?? [])];
  const featuredIds = normalizeFeaturedAchievementIds(
    effectiveData?.featured.map((achievement) => achievement.id) ?? [],
    effectiveData?.maxFeatured ?? 4
  );
  const visibleAchievements = useMemo(() => {
    const achievements = effectiveData?.achievements ?? [];
    const filtered =
      category === "all"
        ? achievements
        : achievements.filter((achievement) => achievement.category === category);
    return sortAchievements(filtered, sort);
  }, [category, effectiveData?.achievements, sort]);
  const unlockedPercent = effectiveData?.totalCount
    ? Math.round((effectiveData.unlockedCount / effectiveData.totalCount) * 100)
    : 0;

  function updateFeatured(nextIds: string[]) {
    if (!effectiveData) return;
    const nextSet = new Set(nextIds);
    const achievements = effectiveData.achievements.map((achievement) => ({
      ...achievement,
      isFeatured: nextSet.has(achievement.id),
    }));

    setCurrentData({
      ...effectiveData,
      achievements,
      featured: achievements.filter(
        (achievement) => achievement.unlocked && nextSet.has(achievement.id)
      ),
    });
  }

  function toggleFeatured(achievement: ProfileAchievementItem) {
    if (!achievement.unlocked || !effectiveData) return;
    const currentIds = featuredIds;
    const nextIds = currentIds.includes(achievement.id)
      ? currentIds.filter((id) => id !== achievement.id)
      : normalizeFeaturedAchievementIds(
          [...currentIds, achievement.id],
          effectiveData.maxFeatured
        );

    startTransition(async () => {
      try {
        await setProfileFeaturedAchievements({ achievementIds: nextIds });
        updateFeatured(nextIds);
        showToast(t("featured_saved"), "success");
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : t("featured_error"),
          "error"
        );
      }
    });
  }

  if (privateState) {
    return <EmptyState privateState />;
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 rounded-[24px] border border-outline-variant bg-surface-container-lowest p-6 shadow-token-card sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-warning-container text-on-warning-container">
            <Award className="size-6" />
          </span>
          <h2 className="text-lg font-extrabold text-on-surface">{t("title")}</h2>
        </div>
        <div className="w-full sm:max-w-[300px]">
          <div className="flex items-center justify-between type-caption font-bold tabular-nums">
            <span className="text-on-surface">
              {t("unlocked_count", {
                count: effectiveData.unlockedCount,
                total: effectiveData.totalCount,
              })}
            </span>
            <span className="text-on-surface-variant">{unlockedPercent}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-container-high">
            <motion.div
              initial={prefersReducedMotion ? false : { width: 0 }}
              animate={{ width: `${unlockedPercent}%` }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full bg-reward"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((item) => {
            const active = item === category;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={cn(
                  "inline-flex h-11 items-center rounded-full border px-4 text-sm font-bold transition-all active:scale-95",
                  active
                    ? "border-primary bg-primary text-on-primary shadow-token-primary"
                    : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-primary/35 hover:text-on-surface"
                )}
              >
                {item === "all" ? t("all") : getCategoryLabel(item, t)}
              </button>
            );
          })}
        </div>

        <label className="relative w-full lg:ml-auto lg:w-[200px]">
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as AchievementSort)}
            className="h-11 w-full appearance-none rounded-full border border-outline-variant bg-surface-container-lowest pl-4 pr-10 text-sm font-bold text-on-surface outline-none transition focus:border-primary/45"
          >
            <option value="featured">{t("sort_featured")}</option>
            <option value="recent">{t("sort_recent")}</option>
            <option value="progress">{t("sort_progress")}</option>
            <option value="category">{t("sort_category")}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
        </label>
      </div>

      {visibleAchievements.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleAchievements.map((achievement, index) => (
            <AchievementCard
              key={achievement.id}
              achievement={achievement}
              index={index}
              canFeature={canFeature}
              featuredIds={featuredIds}
              maxFeatured={effectiveData.maxFeatured}
              onToggleFeatured={toggleFeatured}
              onSelect={setSelected}
              pending={isPending}
            />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}

      {selected ? (
        <AchievementInfoDialog
          achievement={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
