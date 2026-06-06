"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { setProfileFeaturedAchievements } from "@/app/actions/profile-social";
import {
  Award,
  CheckCircle2,
  ChevronDown,
  Lock,
  Medal,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "@/components/ui/icons";
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

function AchievementMedallion({
  achievement,
  size = "md",
}: {
  achievement: ProfileAchievementItem;
  size?: "sm" | "md" | "lg";
}) {
  const unlocked = achievement.unlocked;
  const colorClass = unlocked
    ? achievement.isFeatured
      ? "border-primary-fixed bg-surface-container text-primary-dim"
      : "border-warning bg-surface-container text-on-surface-variant"
    : "border-outline-variant bg-surface-container text-muted-foreground grayscale";

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full border-2 font-semibold shadow-token-card",
        colorClass,
        size === "sm" && "h-12 w-12 text-lg",
        size === "md" && "h-16 w-16 text-2xl",
        size === "lg" && "h-20 w-20 text-3xl"
      )}
    >
      {unlocked ? achievement.icon : <Lock className="h-6 w-6" />}
      {achievement.isFeatured ? (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
          <Star className="h-3 w-3 fill-current" />
        </span>
      ) : null}
    </span>
  );
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
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievement-dialog-title"
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-md rounded-xl border border-outline-variant bg-white p-6 shadow-token-card"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface transition hover:bg-surface-container-high"
        >
          <X className="h-4.5 w-4.5" />
        </button>
        <div className="flex items-start gap-4">
          <AchievementMedallion achievement={achievement} size="lg" />
          <div className="min-w-0 flex-1 pr-8">
            <p className="text-xs font-semibold uppercase text-on-surface-variant">
              {getCategoryLabel(achievement.category, t)}
            </p>
            <h2 id="achievement-dialog-title" className="mt-1 text-xl font-semibold text-on-surface">
              {achievement.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              {achievement.description}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-outline-variant bg-background p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-on-surface">{t("progress")}</span>
            <span className="font-medium text-on-surface-variant">
              {achievement.progressValue != null && achievement.progressTarget != null
                ? `${achievement.progressValue} / ${achievement.progressTarget}`
                : achievement.unlocked
                  ? t("complete")
                  : t("incomplete")}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-sm text-on-surface-variant sm:grid-cols-2">
          <div className="rounded-lg border border-outline-variant p-3">
            <p className="text-xs font-medium text-on-surface-variant">{t("xp_reward")}</p>
            <p className="mt-1 font-semibold text-on-surface">
              {achievement.xpReward} XP
            </p>
          </div>
          <div className="rounded-lg border border-outline-variant p-3">
            <p className="text-xs font-medium text-on-surface-variant">{t("title_reward")}</p>
            <p className="mt-1 font-semibold text-on-surface">
              {achievement.titleReward ?? t("none")}
            </p>
          </div>
        </div>

      </section>
    </div>
  );
}

function EmptyState({ privateState }: { privateState?: boolean }) {
  const t = useTranslations("profileSocial.achievements");

  return (
    <section className="rounded-xl border border-dashed border-outline-variant bg-white px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        {privateState ? (
          <ShieldCheck className="h-6 w-6" />
        ) : (
          <Award className="h-6 w-6" />
        )}
      </div>
      <h2 className="mt-5 text-xl font-semibold text-on-surface">
        {privateState ? t("private_title") : t("empty_title")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-on-surface-variant">
        {privateState ? t("private_body") : t("empty_body")}
      </p>
    </section>
  );
}

function FeaturedRow({
  achievements,
  onSelect,
}: {
  achievements: ProfileAchievementItem[];
  onSelect: (achievement: ProfileAchievementItem) => void;
}) {
  const t = useTranslations("profileSocial.achievements");

  if (achievements.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Medal className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-on-surface">{t("featured")}</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {achievements.map((achievement) => (
          <article
            key={achievement.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(achievement)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(achievement);
              }
            }}
            className="flex min-h-[6rem] cursor-pointer items-center gap-4 rounded-xl border border-primary-fixed bg-white p-4 shadow-token-card transition hover:-translate-y-0.5 hover:shadow-token-primary"
          >
            <AchievementMedallion achievement={achievement} />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-on-surface">
            {achievement.title}
              </h3>
              <p className="mt-1 text-xs font-medium text-on-surface-variant">
                {getCategoryLabel(achievement.category, t)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AchievementCard({
  achievement,
  canFeature,
  featuredIds,
  maxFeatured,
  onToggleFeatured,
      onSelect,
      pending,
}: {
  achievement: ProfileAchievementItem;
  canFeature: boolean;
  featuredIds: string[];
  maxFeatured: number;
  onToggleFeatured: (achievement: ProfileAchievementItem) => void;
  onSelect: (achievement: ProfileAchievementItem) => void;
  pending: boolean;
}) {
  const t = useTranslations("profileSocial.achievements");
  const percent = getAchievementProgressPercent(achievement);
  const featured = featuredIds.includes(achievement.id);
  const featureDisabled =
    pending ||
    !achievement.unlocked ||
    (!featured && featuredIds.length >= maxFeatured);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(achievement)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(achievement);
        }
      }}
      className={cn(
        "relative grid min-h-[176px] cursor-pointer gap-4 rounded-xl border bg-white p-4 shadow-token-card transition hover:-translate-y-0.5 hover:shadow-token-card",
        featured ? "border-primary-fixed ring-1 ring-primary-fixed" : "border-outline-variant"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <AchievementMedallion achievement={achievement} size="lg" />
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
              "flex h-9 w-9 items-center justify-center rounded-full border transition",
              featured
                ? "border-primary-fixed bg-surface-container text-primary-dim"
                : "border-outline-variant bg-white text-on-surface-variant hover:bg-background hover:text-on-surface",
              featureDisabled && "cursor-not-allowed opacity-50"
            )}
          >
            <Star className={cn("h-4.5 w-4.5", featured && "fill-current")} />
          </button>
        ) : featured ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-primary-fixed bg-surface-container text-primary-dim">
            <Star className="h-4.5 w-4.5 fill-current" />
          </span>
        ) : null}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {achievement.unlocked ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <Lock className="h-4 w-4 text-muted-foreground" />
          )}
          <span
            className={cn(
              "text-xs font-semibold",
              achievement.unlocked ? "text-success" : "text-on-surface-variant"
            )}
          >
            {achievement.unlocked ? t("complete") : t("incomplete")}
          </span>
        </div>
        <h3 className="mt-2 line-clamp-2 text-lg font-semibold leading-6 text-on-surface">
          {achievement.title}
        </h3>
        <p className="mt-1 text-sm text-on-surface-variant">
          {getCategoryLabel(achievement.category, t)}
        </p>
      </div>

      <div className="mt-auto">
        <div className="flex items-center justify-between text-xs font-medium text-on-surface-variant">
          <span>
            {achievement.progressValue != null && achievement.progressTarget != null
              ? `${achievement.progressValue} / ${achievement.progressTarget}`
              : achievement.unlocked
                ? t("complete")
                : t("progress")}
          </span>
          <span>{percent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-container-high">
          <div
            className={cn(
              "h-full rounded-full",
              achievement.unlocked ? "bg-primary" : "bg-primary-fixed"
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </article>
  );
}

export function ProfileAchievementsTab({
  data,
}: {
  data: ProfileAchievementsData | null | undefined;
}) {
  const t = useTranslations("profileSocial.achievements");
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
    <div className="grid gap-8">
      <div>
        <h2 className="text-xl font-semibold text-on-surface">{t("title")}</h2>
        <p className="mt-2 text-sm text-on-surface-variant">{t("subtitle")}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-white px-3 py-2 font-semibold text-on-surface">
            <Award className="h-4 w-4 text-primary" />
            {t("unlocked_count", {
              count: effectiveData.unlockedCount,
              total: effectiveData.totalCount,
            })}
          </span>
          {canFeature ? (
            <span className="inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-white px-3 py-2 font-medium text-on-surface-variant">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("featured_limit", { count: effectiveData.maxFeatured })}
            </span>
          ) : null}
        </div>
      </div>

      <FeaturedRow achievements={effectiveData.featured} onSelect={setSelected} />

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
                  "inline-flex h-10 items-center rounded-lg border px-3 text-sm font-semibold transition",
                  active
                    ? "border-transparent bg-primary text-white"
                    : "border-outline-variant bg-white text-on-surface-variant hover:border-outline-variant hover:text-on-surface"
                )}
              >
                {item === "all" ? t("all") : getCategoryLabel(item, t)}
              </button>
            );
          })}
        </div>

        <label className="relative w-full lg:ml-auto lg:w-[220px]">
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as AchievementSort)}
            className="h-10 w-full appearance-none rounded-lg border border-outline-variant bg-white pl-3 pr-9 text-sm font-semibold text-on-surface outline-none transition focus:border-primary"
          >
            <option value="featured">{t("sort_featured")}</option>
            <option value="recent">{t("sort_recent")}</option>
            <option value="progress">{t("sort_progress")}</option>
            <option value="category">{t("sort_category")}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </label>
      </div>

      {visibleAchievements.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleAchievements.map((achievement) => (
            <AchievementCard
              key={achievement.id}
              achievement={achievement}
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
