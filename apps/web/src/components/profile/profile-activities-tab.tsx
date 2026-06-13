"use client";

import Image from "next/image";
import { useMemo, useState, type ComponentType } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock3,
  GraduationCap,
  History,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type {
  ProfileActivityFeedData,
  ProfileActivityFeedItem,
  ProfileActivityKind,
} from "@/lib/profile-social/tab-model";

type ActivityFilter = "all" | "practice" | "duel" | "learning";
type ActivitySort = "newest" | "oldest" | "highest";

const EMPTY_STATE_IMAGE = "/images/mascot/mascot-sleeping.webp";

const ACTIVITY_FILTERS: Array<{ value: ActivityFilter; labelKey: string }> = [
  { value: "all", labelKey: "filters.all" },
  { value: "practice", labelKey: "filters.practice" },
  { value: "duel", labelKey: "filters.duel" },
  { value: "learning", labelKey: "filters.learning" },
];

function activityMatchesFilter(item: ProfileActivityFeedItem, filter: ActivityFilter) {
  if (filter === "all") return true;
  if (filter === "learning") return item.kind === "lesson" || item.kind === "course";
  return item.kind === filter;
}

function getActivityMeta(kind: ProfileActivityKind): {
  icon: ComponentType<{ className?: string }>;
  tileClassName: string;
  labelKey: string;
} {
  switch (kind) {
    case "practice":
      return {
        icon: History,
        tileClassName: "bg-[#E3F3FF] text-[#1D7FD6] dark:bg-[#3B9EFF]/15 dark:text-[#6FB9FF]",
        labelKey: "kinds.practice",
      };
    case "duel":
      return {
        icon: Swords,
        tileClassName: "bg-[#FFEAEA] text-[#D6494E] dark:bg-[#FF5A5F]/15 dark:text-[#FF9398]",
        labelKey: "kinds.duel",
      };
    case "lesson":
      return {
        icon: BookOpen,
        tileClassName: "bg-[#E5F6EC] text-[#1E9E54] dark:bg-[#34C759]/15 dark:text-[#5DD984]",
        labelKey: "kinds.lesson",
      };
    case "course":
      return {
        icon: GraduationCap,
        tileClassName: "bg-[#EFEAFE] text-[#6D4FD0] dark:bg-[#8B5CF6]/15 dark:text-[#B49AFC]",
        labelKey: "kinds.course",
      };
    case "level":
      return {
        icon: Sparkles,
        tileClassName: "bg-[#FFF3DC] text-[#C98A1B] dark:bg-[#FFD166]/15 dark:text-[#FFD98A]",
        labelKey: "kinds.level",
      };
    default:
      return {
        icon: Sparkles,
        tileClassName: "bg-surface-container text-on-surface-variant",
        labelKey: "kinds.activity",
      };
  }
}

function getScorePillClassName(score: number) {
  if (score >= 80) {
    return "bg-[#E5F6EC] text-[#1E9E54] dark:bg-[#34C759]/15 dark:text-[#5DD984]";
  }
  if (score >= 55) {
    return "bg-[#E3F3FF] text-[#1D7FD6] dark:bg-[#3B9EFF]/15 dark:text-[#6FB9FF]";
  }
  return "bg-[#FFF3DC] text-[#C98A1B] dark:bg-[#FFD166]/15 dark:text-[#FFD98A]";
}

function formatActivityDate(iso: string, locale: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function EmptyState({ privateState }: { privateState?: boolean }) {
  const t = useTranslations("profileSocial.activities");

  return (
    <section className="rounded-[24px] border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-14 text-center">
      {privateState ? (
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
          <ShieldCheck className="size-6" />
        </div>
      ) : (
        <Image
          src={EMPTY_STATE_IMAGE}
          alt=""
          width={130}
          height={130}
          unoptimized
          aria-hidden="true"
          className="mx-auto h-[110px] w-[110px] object-contain"
        />
      )}
      <h2 className="mt-5 text-lg font-bold text-on-surface">
        {privateState ? t("private_title") : t("empty_title")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-on-surface-variant">
        {privateState ? t("private_body") : t("empty_body")}
      </p>
    </section>
  );
}

function ActivityCard({
  item,
  index,
}: {
  item: ProfileActivityFeedItem;
  index: number;
}) {
  const t = useTranslations("profileSocial.activities");
  const locale = useLocale();
  const prefersReducedMotion = useReducedMotion();
  const meta = getActivityMeta(item.kind);
  const Icon = meta.icon;

  return (
    <motion.article
      initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.26,
        delay: Math.min(index * 0.035, 0.3),
        ease: [0.22, 1, 0.36, 1],
      }}
      className="grid gap-4 rounded-[20px] border border-outline-variant bg-surface-container-lowest p-5 shadow-token-card transition-transform duration-200 hover:-translate-y-0.5 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-center"
    >
      <span
        className={cn(
          "flex size-14 items-center justify-center rounded-2xl",
          meta.tileClassName
        )}
      >
        <Icon className="size-6" />
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 type-caption font-bold leading-none",
              meta.tileClassName
            )}
          >
            {t(meta.labelKey)}
          </span>
          {item.xpEarned > 0 ? (
            <span className="inline-flex items-center rounded-full bg-[#FFF3DC] px-2.5 py-1 type-caption font-bold leading-none text-[#C98A1B] dark:bg-[#FFD166]/15 dark:text-[#FFD98A]">
              +{item.xpEarned} XP
            </span>
          ) : null}
        </div>
        <h3 className="mt-2 line-clamp-2 type-title font-bold leading-6 text-on-surface">
          {item.title}
        </h3>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 type-caption font-semibold text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4" />
            {formatActivityDate(item.createdAt, locale)}
          </span>
          {item.durationMinutes ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-4" />
              {t("minutes", { count: item.durationMinutes })}
            </span>
          ) : null}
          {item.score != null ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 type-caption font-bold leading-none tabular-nums",
                getScorePillClassName(item.score)
              )}
            >
              {t("score", { score: item.score })}
            </span>
          ) : null}
        </div>
      </div>

      {item.href ? (
        <Link
          href={item.href}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold text-primary transition-all hover:bg-primary/[0.06] active:scale-95"
        >
          {t("review")}
          <ArrowRight className="size-4" />
        </Link>
      ) : null}
    </motion.article>
  );
}

export function ProfileActivitiesTab({
  data,
}: {
  data: ProfileActivityFeedData | null | undefined;
}) {
  const t = useTranslations("profileSocial.activities");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [sort, setSort] = useState<ActivitySort>("newest");

  const isPrivate =
    !data || data.state === "private" || data.state === "blocked" || data.state === "not_found";
  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    const normalizedQuery = query.trim().toLowerCase();
    const nextItems = items
      .filter((item) => activityMatchesFilter(item, filter))
      .filter((item) => {
        if (!normalizedQuery) return true;
        return [item.title, item.subtitle, item.kind]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      });

    nextItems.sort((left, right) => {
      if (sort === "highest") {
        if (left.score == null && right.score == null) {
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        }
        if (left.score == null) return 1;
        if (right.score == null) return -1;
        return right.score - left.score;
      }

      const newest = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      return sort === "oldest" ? -newest : newest;
    });

    return nextItems;
  }, [data?.items, filter, query, sort]);

  if (isPrivate) {
    return <EmptyState privateState />;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative w-full lg:w-[300px]">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search_placeholder")}
            className="h-11 w-full rounded-full border border-outline-variant bg-surface-container-lowest pl-11 pr-4 text-sm font-medium text-on-surface outline-none transition-all placeholder:text-on-surface-variant/70 focus:border-primary/45 focus:ring-3 focus:ring-primary/15"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {ACTIVITY_FILTERS.map((item) => {
            const active = item.value === filter;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={cn(
                  "inline-flex h-11 items-center justify-center rounded-full border px-4 text-sm font-bold transition-all active:scale-95",
                  active
                    ? "border-primary bg-primary text-on-primary shadow-token-primary"
                    : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-primary/35 hover:text-on-surface"
                )}
              >
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>

        <label className="relative w-full lg:ml-auto lg:w-[200px]">
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as ActivitySort)}
            className="h-11 w-full appearance-none rounded-full border border-outline-variant bg-surface-container-lowest pl-4 pr-10 text-sm font-bold text-on-surface outline-none transition focus:border-primary/45"
          >
            <option value="newest">{t("sort_newest")}</option>
            <option value="oldest">{t("sort_oldest")}</option>
            <option value="highest">{t("sort_highest")}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
        </label>
      </div>

      {filteredItems.length > 0 ? (
        <div className="grid gap-3">
          {filteredItems.map((item, index) => (
            <ActivityCard key={item.id} item={item} index={index} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
