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
      ? "border-[#A9C6FB] bg-[#F1F6FD] text-[#3E78EC]"
      : "border-[#F5B942] bg-[#FFF8E6] text-[#A66A00]"
    : "border-[#DEE8F8] bg-[#EEF2F7] text-[#8A96A8] grayscale";

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full border-2 font-semibold shadow-[inset_0_0_0_6px_rgba(255,255,255,0.58)]",
        colorClass,
        size === "sm" && "h-12 w-12 text-lg",
        size === "md" && "h-16 w-16 text-2xl",
        size === "lg" && "h-20 w-20 text-3xl"
      )}
    >
      {unlocked ? achievement.icon : <Lock className="h-6 w-6" />}
      {achievement.isFeatured ? (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#4D86F7] text-white">
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1424]/55 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievement-dialog-title"
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-md rounded-xl border border-[#DEE8F8] bg-white p-6 shadow-[0_28px_80px_-42px_rgba(11,20,36,0.28)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#EEF2F7] text-[#0B1424] transition hover:bg-[#DEE8F8]"
        >
          <X className="h-4.5 w-4.5" />
        </button>
        <div className="flex items-start gap-4">
          <AchievementMedallion achievement={achievement} size="lg" />
          <div className="min-w-0 flex-1 pr-8">
            <p className="text-xs font-semibold uppercase text-[#718096]">
              {getCategoryLabel(achievement.category, t)}
            </p>
            <h2 id="achievement-dialog-title" className="mt-1 text-xl font-semibold text-[#0B1424]">
              {achievement.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#718096]">
              {achievement.description}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-[#DEE8F8] bg-[#F7FAFE] p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-[#0B1424]">{t("progress")}</span>
            <span className="font-medium text-[#718096]">
              {achievement.progressValue != null && achievement.progressTarget != null
                ? `${achievement.progressValue} / ${achievement.progressTarget}`
                : achievement.unlocked
                  ? t("complete")
                  : t("incomplete")}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#DEE8F8]">
            <div
              className="h-full rounded-full bg-[#4D86F7]"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-sm text-[#415069] sm:grid-cols-2">
          <div className="rounded-lg border border-[#DEE8F8] p-3">
            <p className="text-xs font-medium text-[#718096]">{t("xp_reward")}</p>
            <p className="mt-1 font-semibold text-[#0B1424]">
              {achievement.xpReward} XP
            </p>
          </div>
          <div className="rounded-lg border border-[#DEE8F8] p-3">
            <p className="text-xs font-medium text-[#718096]">{t("title_reward")}</p>
            <p className="mt-1 font-semibold text-[#0B1424]">
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
    <section className="rounded-xl border border-dashed border-[#D9E5F4] bg-white px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF2F7] text-[#718096]">
        {privateState ? (
          <ShieldCheck className="h-6 w-6" />
        ) : (
          <Award className="h-6 w-6" />
        )}
      </div>
      <h2 className="mt-5 text-xl font-semibold text-[#0B1424]">
        {privateState ? t("private_title") : t("empty_title")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#718096]">
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
        <Medal className="h-4 w-4 text-[#4D86F7]" />
        <h2 className="text-sm font-semibold text-[#0B1424]">{t("featured")}</h2>
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
            className="flex min-h-[6rem] cursor-pointer items-center gap-4 rounded-xl border border-[#A9C6FB] bg-white p-4 shadow-[0_18px_44px_-42px_rgba(62,120,236,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_54px_-44px_rgba(77,134,247,0.45)]"
          >
            <AchievementMedallion achievement={achievement} />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-[#0B1424]">
            {achievement.title}
              </h3>
              <p className="mt-1 text-xs font-medium text-[#718096]">
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
        "relative grid min-h-[176px] cursor-pointer gap-4 rounded-xl border bg-white p-4 shadow-[0_18px_44px_-42px_rgba(62,120,236,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_54px_-44px_rgba(17,17,17,0.55)]",
        featured ? "border-[#A9C6FB] ring-1 ring-[#A9C6FB]" : "border-[#DEE8F8]"
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
                ? "border-[#A9C6FB] bg-[#F1F6FD] text-[#3E78EC]"
                : "border-[#DEE8F8] bg-white text-[#718096] hover:bg-[#F7FAFE] hover:text-[#0B1424]",
              featureDisabled && "cursor-not-allowed opacity-50"
            )}
          >
            <Star className={cn("h-4.5 w-4.5", featured && "fill-current")} />
          </button>
        ) : featured ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#A9C6FB] bg-[#F1F6FD] text-[#3E78EC]">
            <Star className="h-4.5 w-4.5 fill-current" />
          </span>
        ) : null}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {achievement.unlocked ? (
            <CheckCircle2 className="h-4 w-4 text-[#34C759]" />
          ) : (
            <Lock className="h-4 w-4 text-[#8A96A8]" />
          )}
          <span
            className={cn(
              "text-xs font-semibold",
              achievement.unlocked ? "text-[#34C759]" : "text-[#718096]"
            )}
          >
            {achievement.unlocked ? t("complete") : t("incomplete")}
          </span>
        </div>
        <h3 className="mt-2 line-clamp-2 text-lg font-semibold leading-6 text-[#0B1424]">
          {achievement.title}
        </h3>
        <p className="mt-1 text-sm text-[#718096]">
          {getCategoryLabel(achievement.category, t)}
        </p>
      </div>

      <div className="mt-auto">
        <div className="flex items-center justify-between text-xs font-medium text-[#718096]">
          <span>
            {achievement.progressValue != null && achievement.progressTarget != null
              ? `${achievement.progressValue} / ${achievement.progressTarget}`
              : achievement.unlocked
                ? t("complete")
                : t("progress")}
          </span>
          <span>{percent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#DEE8F8]">
          <div
            className={cn(
              "h-full rounded-full",
              achievement.unlocked ? "bg-[#4D86F7]" : "bg-[#A9C6FB]"
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
        <h2 className="text-xl font-semibold text-[#0B1424]">{t("title")}</h2>
        <p className="mt-2 text-sm text-[#718096]">{t("subtitle")}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="inline-flex items-center gap-2 rounded-lg border border-[#DEE8F8] bg-white px-3 py-2 font-semibold text-[#0B1424]">
            <Award className="h-4 w-4 text-[#4D86F7]" />
            {t("unlocked_count", {
              count: effectiveData.unlockedCount,
              total: effectiveData.totalCount,
            })}
          </span>
          {canFeature ? (
            <span className="inline-flex items-center gap-2 rounded-lg border border-[#DEE8F8] bg-white px-3 py-2 font-medium text-[#718096]">
              <Sparkles className="h-4 w-4 text-[#4D86F7]" />
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
                    ? "border-transparent bg-[#4D86F7] text-white"
                    : "border-[#DEE8F8] bg-white text-[#415069] hover:border-[#D9E5F4] hover:text-[#0B1424]"
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
            className="h-10 w-full appearance-none rounded-lg border border-[#DEE8F8] bg-white pl-3 pr-9 text-sm font-semibold text-[#0B1424] outline-none transition focus:border-[#4D86F7]"
          >
            <option value="featured">{t("sort_featured")}</option>
            <option value="recent">{t("sort_recent")}</option>
            <option value="progress">{t("sort_progress")}</option>
            <option value="category">{t("sort_category")}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A96A8]" />
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
